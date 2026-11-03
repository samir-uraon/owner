 
import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { cookies } from "next/headers";
import { ObjectId } from "mongodb";
import clientPromise from "@/lib/mongodb";

const TEAM_ROLES = ["staff", "doctor"];
const LOGIN_ROLES = ["owner", ...TEAM_ROLES];

function normalizeEmail(value) {
  return typeof value === "string"
    ? value.trim().toLowerCase()
    : "";
}

function normalizeRole(value) {
  return String(value || "").trim().toLowerCase();
}

function getTeamConditions(identifier) {
  const value = String(identifier || "").trim();

  if (!value) return [];

  if (value.includes("@")) {
    const email = normalizeEmail(value);

    return [
      { email },
      { emailAddress: email },
    ];
  }

  const conditions = [
    { mobile: value },
    { phone: value },
    { teamMemberId: value },
    { id: value },
    { employeeId: value },
  ];

  if (ObjectId.isValid(value)) {
    conditions.push({ _id: new ObjectId(value) });
  }

  return conditions;
}

function isActiveAccount(account) {
  return (
    account?.isActive === true ||
    String(account?.status || "").trim().toLowerCase() === "active"
  );
}

function toTeamUser(account) {
  if (!account) return null;

  const role = normalizeRole(account.role);

  if (!TEAM_ROLES.includes(role) || !isActiveAccount(account)) {
    return null;
  }

  return {
    id: account._id.toString(),
    name: account.fullName || account.name || "",
    email: normalizeEmail(account.email || account.emailAddress) || null,
    phone: account.phone || account.mobile || "",
    role,
    isConfigured: account.isConfigured ?? true,
  };
}

function toOwnerUser(owner) {
  if (!owner || owner.isVerified !== true) return null;

  return {
    id: owner._id.toString(),
    name: owner.fullName || owner.name || "",
    email: normalizeEmail(owner.email) || null,
    phone: owner.mobile || owner.phone || "",
    role: "owner",
    isConfigured: owner.isConfigured ?? false,
  };
}

async function findTeamMemberByEmail(db, email, role) {
  const members = await db
    .collection("team")
    .find({
      $or: [
        { email: normalizeEmail(email) },
        { emailAddress: normalizeEmail(email) },
      ],
    })
    .toArray();

  return (
    members.find(
      (member) =>
        normalizeRole(member.role) === role &&
        isActiveAccount(member)
    ) || null
  );
}

export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),

    CredentialsProvider({
      id: "credentials",
      name: "Email, ID and Password",

      credentials: {
        identifier: { label: "Email or Mobile", type: "text" },
        password: { label: "Password", type: "password" },
        role: { label: "Role", type: "text" },
        verificationToken: { label: "Verification Token", type: "text" },
      },

      async authorize(credentials) {
        try {
          const role = normalizeRole(credentials?.role);

          if (!LOGIN_ROLES.includes(role)) return null;

          const client = await clientPromise;
          const db = client.db(process.env.MONGODB);
          const now = new Date();

          // OWNER LOGIN AFTER OTP VERIFICATION
          if (credentials?.verificationToken) {
            if (role !== "owner") return null;

            const tokenHash = crypto
              .createHash("sha256")
              .update(credentials.verificationToken)
              .digest("hex");

            const ticketResult = await db
              .collection("otpLoginTokens")
              .findOneAndUpdate(
                {
                  tokenHash,
                  role: "owner",
                  expiresAt: { $gt: now },
                  consumedAt: null,
                },
                {
                  $set: { consumedAt: now },
                },
                {
                  returnDocument: "after",
                }
              );

            const ticket = ticketResult?.value ?? ticketResult;

            if (!ticket?.email) return null;

            const owner = await db.collection("owners").findOne({
              email: normalizeEmail(ticket.email),
              isVerified: true,
            });

            return toOwnerUser(owner);
          }

          const identifier = String(
            credentials?.identifier || ""
          ).trim();

          const password = credentials?.password;

          if (!identifier || typeof password !== "string" || !password) {
            return null;
          }

          // =====================================
          // OWNER LOGIN
          // =====================================
          if (role === "owner") {
            const conditions = identifier.includes("@")
              ? [{ email: normalizeEmail(identifier) }]
              : [
                  { mobile: identifier },
                  { phone: identifier },
                ];

            const owner = await db.collection("owners").findOne({
              $or: conditions,
            });

            if (!owner || !owner.password) return null;

            const validPassword = await bcrypt.compare(
              password,
              owner.password
            );

            if (!validPassword) return null;

            // Only verified owners can create a session.
            if (owner.isVerified !== true) return null;

            return toOwnerUser(owner);
          }

          // =====================================
          // STAFF AND DOCTOR LOGIN
          // =====================================
          const conditions = getTeamConditions(identifier);

          if (!conditions.length) return null;

          const candidates = await db
            .collection("team")
            .find({ $or: conditions })
            .limit(20)
            .toArray();

          const account =
            candidates.find(
              (member) =>
                normalizeRole(member.role) === role &&
                isActiveAccount(member)
            ) || null;

          if (!account) return null;

          const storedPassword =
            account.passwordHash || account.password;

          if (
            typeof storedPassword !== "string" ||
            !storedPassword
          ) {
            return null;
          }

          let validPassword = false;

          if (/^\$2[aby]\$\d{2}\$/.test(storedPassword)) {
            validPassword = await bcrypt.compare(
              password,
              storedPassword
            );
          } else {
            validPassword = password === storedPassword;
          }

          if (!validPassword) return null;

          return toTeamUser(account);

        } catch (error) {
          console.error("Credentials authorization error:", error);
          return null;
        }
      },
    }),
  ],

  session: {
    strategy: "jwt",
  },

  callbacks: {
    // GOOGLE LOGIN
    async signIn({ user, account }) {
      if (account?.provider !== "google") return true;
      if (!user.email) return false;

      try {
        const client = await clientPromise;
        const db = client.db(process.env.MONGODB);
        const email = normalizeEmail(user.email);
        const cookieStore = await cookies();

        const requestedRole = normalizeRole(
          cookieStore.get("zeriy_login_role")?.value || "owner"
        );

        const now = new Date();

        if (TEAM_ROLES.includes(requestedRole)) {
          const teamMember = await findTeamMemberByEmail(
            db,
            email,
            requestedRole
          );

          if (!teamMember) {
            return `/signin?error=${
              requestedRole === "doctor"
                ? "DoctorAccessDenied"
                : "StaffAccessDenied"
            }`;
          }

          const teamUser = toTeamUser(teamMember);

          if (!teamUser) return false;

          Object.assign(user, teamUser);
          return true;
        }

        if (requestedRole !== "owner") return false;

        const owners = db.collection("owners");

        let owner = await owners.findOne({
          email,
          isVerified: true,
        });

        if (!owner) {
          const pendingOwner = await owners.findOne({
            email,
            isVerified: { $ne: true },
            expiresAt: { $gt: now },
          });

          if (pendingOwner) {
            return `/verify-otp?email=${encodeURIComponent(email)}`;
          }

          const result = await owners.insertOne({
            name: user.name || "",
            email,
            phone: "",
            image: user.image || "",
            password: null,
            provider: "google",
            isVerified: true,
            isConfigured: false,
            clinics: [],
            createdAt: now,
            updatedAt: now,
          });

          owner = {
            _id: result.insertedId,
            name: user.name || "",
            email,
            phone: "",
            isVerified: true,
            isConfigured: false,
          };
        } else {
          await owners.updateOne(
            { _id: owner._id },
            {
              $set: {
                name: user.name || owner.name || "",
                image: user.image || owner.image || "",
                updatedAt: now,
              },
            }
          );

          owner = {
            ...owner,
            name: user.name || owner.name || "",
            image: user.image || owner.image || "",
          };
        }

        const ownerUser = toOwnerUser(owner);

        if (!ownerUser) return false;

        Object.assign(user, ownerUser);
        return true;

      } catch (error) {
        console.error("Google sign-in error:", error);
        return false;
      }
    },

    // JWT
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id || user._id?.toString() || "";
        token.name = user.name || "";
        token.email = normalizeEmail(user.email);
        token.role = normalizeRole(user.role);
        token.phone = user.phone || user.mobile || "";
        token.isConfigured = user.isConfigured ?? false;
      }

      if (trigger === "update" && session?.user) {
        if (typeof session.user.name === "string") {
          token.name = session.user.name;
        }

        if (typeof session.user.phone === "string") {
          token.phone = session.user.phone;
        }
      }

      return token;
    },

    // SESSION
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id || "";
        session.user.name = token.name || "";
        session.user.email = token.email || "";
        session.user.role = token.role || "";
        session.user.phone = token.phone || "";
        session.user.isConfigured = token.isConfigured ?? false;
      }

      return session;
    },

    // REDIRECT
    async redirect({ url, baseUrl }) {
      if (url.startsWith("/")) return `${baseUrl}${url}`;

      try {
        if (new URL(url).origin === new URL(baseUrl).origin) {
          return url;
        }
      } catch {}

      return baseUrl;
    },
  },

  pages: {
    signIn: "/signin",
  },

  secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
