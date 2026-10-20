
import { ObjectId } from "mongodb";
import { getServerSession } from "next-auth";
import clientPromise from "@/lib/mongodb";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export const TEAM_CATEGORIES = {
  clinic: { collection: "clinics", memberKey: "doctors" },
  saloon: { collection: "saloons", memberKey: "staff" },
  "beauty-parlour": { collection: "parlour", memberKey: "staff" },
  "diagnostic-centre": {
    collection: "diagnostic",
    memberKey: "staff",
  },
};

export const normalizeText = (value) =>
  String(value ?? "").trim().toLowerCase();

export function normalizeSlot(value) {
  return String(value ?? "")
    .trim()
    .replace(/[–—−]/g, "-")
    .replace(/\s+/g, "")
    .toLowerCase();
}

export function normalizeDate(value) {
  if (!value) return "";

  if (value instanceof Date) {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(value);
  }

  const input = String(value).trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
    return input;
  }

  const parsed = new Date(input);

  if (Number.isNaN(parsed.getTime())) return "";

  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(parsed);
}

function identityQuery(sessionUser, memberKey) {
  const clauses = [];
  const email = normalizeText(sessionUser.email);

  if (email) {
    clauses.push({ [`${memberKey}.email`]: email });
    clauses.push({ [`${memberKey}.email`]: sessionUser.email });
  }

  const ids = [
    sessionUser.id,
    sessionUser._id,
    sessionUser.userId,
  ].filter(Boolean);

  for (const id of ids) {
    const stringId = String(id);

    for (const field of ["userId", "id", "_id"]) {
      clauses.push({ [`${memberKey}.${field}`]: stringId });

      if (ObjectId.isValid(stringId)) {
        clauses.push({
          [`${memberKey}.${field}`]: new ObjectId(stringId),
        });
      }
    }
  }

  return clauses.length ? { $or: clauses } : null;
}

function matchesMember(member, user) {
  const email = normalizeText(user.email);

  if (email && normalizeText(member.email) === email) {
    return true;
  }

  const userIds = [
    user.id,
    user._id,
    user.userId,
  ].filter(Boolean).map(String);

  const memberIds = [
    member.userId,
    member.id,
    member._id,
  ].filter(Boolean).map(String);

  return userIds.some((id) => memberIds.includes(id));
}

export async function getTeamMemberContext(role) {
  if (!["staff", "doctor"].includes(role)) {
    return { error: "Invalid team role", status: 400 };
  }

  const session = await getServerSession(authOptions);
  const user = session?.user;

  if (!user?.email && !user?.id && !user?._id) {
    return { error: "Unauthorized", status: 401 };
  }

  const client = await clientPromise;
  const db = client.db(process.env.MONGODB);

  const categories =
    role === "doctor"
      ? ["clinic"]
      : ["saloon", "beauty-parlour", "diagnostic-centre"];

  for (const category of categories) {
    const config = TEAM_CATEGORIES[category];
    const query = identityQuery(user, config.memberKey);

    if (!query) continue;

    const businesses = await db
      .collection(config.collection)
      .find(query)
      .limit(100)
      .toArray();

    for (const business of businesses) {
      const members = Array.isArray(business[config.memberKey])
        ? business[config.memberKey]
        : [];

      const memberIndex = members.findIndex((member) =>
        matchesMember(member, user)
      );

      if (memberIndex === -1) continue;

      const member = members[memberIndex];

      return {
        db,
        session,
        user,
        role,
        category,
        collectionName: config.collection,
        memberKey: config.memberKey,
        memberIndex,
        member,
        business,
        businessId: String(business._id),
        memberId: String(member.id ?? member._id ?? memberIndex),
      };
    }
  }

  return {
    error: "No team-member record is linked to this account",
    status: 403,
  };
}

export function publicTeamProfile(context) {
  const { member, business } = context;

  return {
    role: context.role,
    category: context.category,
    businessId: context.businessId,
    businessName: business.businessName || business.name || "",
    memberId: context.memberId,
    name: member.name || "",
    email: member.email || context.user.email || "",
    phone: member.phone || "",
    profileImage: member.profileImage || member.image || "",
    experience: member.experience ?? "",
    specialization: member.specialization || "",
    fee: member.fee ?? "",
    services: Array.isArray(member.services)
      ? member.services.join(", ")
      : member.services || "",
    schedule: member.schedule || {},
  };
}
