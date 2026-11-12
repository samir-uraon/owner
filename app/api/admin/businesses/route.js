
import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import { getAdminSession } from "@/lib/admin-auth";

 

const BUSINESS_COLLECTIONS = [
  { key: "clinic", collection: "clinics", label: "Clinic" },
  { key: "saloon", collection: "saloons", label: "Salon" },
  { key: "beauty-parlour", collection: "parlour", label: "Beauty Parlour" },
  { key: "diagnostic-centre", collection: "diagnostic", label: "Diagnostic Centre" },
];

const PROJECTION = {
  password: 0,
  passwordHash: 0,
  otp: 0,
  otpHash: 0,
  verificationToken: 0,
  secret: 0,
  apiKey: 0,
};

function getBusinessName(doc) {
  return (
    doc.businessName ||
    doc.clinicName ||
    doc.saloonName ||
    doc.parlourName ||
    doc.diagnosticName ||
    doc.name ||
    doc.title ||
    "Unnamed business"
  );
}

function getBusinessAddress(doc) {
  if (typeof doc.address === "string") return doc.address;

  if (doc.address && typeof doc.address === "object") {
    return [
      doc.address.address,
      doc.address.city,
      doc.address.state,
      doc.address.pinCode,
    ]
      .filter(Boolean)
      .join(", ");
  }

  return [
    doc.locationName,
    doc.city,
    doc.state,
    doc.pinCode,
  ]
    .filter(Boolean)
    .join(", ");
}

export async function GET(req) {
  try {
    const admin = await getAdminSession();

    if (!admin) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);

    const search = searchParams.get("search")?.trim() || "";
    const category = searchParams.get("category") || "all";
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const limit = Math.min(
      50,
      Math.max(1, Number(searchParams.get("limit")) || 10)
    );

    const selectedCollections =
      category === "all"
        ? BUSINESS_COLLECTIONS
        : BUSINESS_COLLECTIONS.filter((item) => item.key === category);

    if (!selectedCollections.length) {
      return NextResponse.json(
        { success: false, message: "Invalid business category" },
        { status: 400 }
      );
    }

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB || "rahul");

    const searchRegex = search
      ? { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" }
      : null;

    const filter = searchRegex
      ? {
          $or: [
            { name: searchRegex },
            { businessName: searchRegex },
            { clinicName: searchRegex },
            { saloonName: searchRegex },
            { parlourName: searchRegex },
            { diagnosticName: searchRegex },
            { address: searchRegex },
            { locationName: searchRegex },
            { city: searchRegex },
            { state: searchRegex },
          ],
        }
      : {};

    const totalCounts = await Promise.all(
      selectedCollections.map(({ collection }) =>
        db.collection(collection).countDocuments(filter)
      )
    );

    const total = totalCounts.reduce((sum, count) => sum + count, 0);

    // Fetch a bounded number from each collection, then paginate the combined list.
    const fetchLimit = Math.min(page * limit, 2500);

    const collectionResults = await Promise.all(
      selectedCollections.map(async (item) => {
        const docs = await db
          .collection(item.collection)
          .find(filter, { projection: PROJECTION })
          .sort({ createdAt: -1, _id: -1 })
          .limit(fetchLimit)
          .toArray();

        return docs.map((doc) => ({
          id: doc._id.toString(),
          category: item.key,
          categoryLabel: item.label,
          name: getBusinessName(doc),
          address: getBusinessAddress(doc),
          city: doc.city || doc.address?.city || "",
          ownerId: doc.ownerId?.toString?.() || doc.userId?.toString?.() || "",
          status:
            doc.status ||
            (doc.isActive === false
              ? "Inactive"
              : doc.isVerified === false
                ? "Pending"
                : "Active"),
          createdAt: doc.createdAt || null,
        }));
      })
    );

    const businesses = collectionResults
      .flat()
      .sort((a, b) => {
        const dateA = new Date(a.createdAt || 0).getTime();
        const dateB = new Date(b.createdAt || 0).getTime();
        return dateB - dateA;
      });

    const startIndex = (page - 1) * limit;
    const paginatedBusinesses = businesses.slice(
      startIndex,
      startIndex + limit
    );

    return NextResponse.json({
      success: true,
      businesses: paginatedBusinesses,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Admin businesses API error:", error);

    return NextResponse.json(
      { success: false, message: "Failed to load businesses" },
      { status: 500 }
    );
  }
}
