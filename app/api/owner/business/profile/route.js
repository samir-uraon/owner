
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { ObjectId } from "mongodb";
import clientPromise from "@/lib/mongodb";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

const CATEGORIES = {
  clinic: "clinics",
  saloon: "saloons",
  "beauty-parlour": "parlour",
  "diagnostic-centre": "diagnostic",
};

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function getOwnedBusiness(db, session, businessId, category) {
  if (!session?.user?.email || !session.user.id) {
    return { error: "Please sign in first.", status: 401 };
  }

  if (
    !businessId ||
    !ObjectId.isValid(businessId) ||
    !category ||
    !CATEGORIES[category]
  ) {
    return { error: "Invalid Data.", status: 400 };
  }

  const owner = await db.collection("owners").findOne(
    {
      email: {
        $regex: `^${escapeRegex(session.user.email.trim())}$`,
        $options: "i",
      },
    },
    { projection: { _id: 1, business: 1 } }
  );

  if (!owner) {
    return { error: "Owner account not found.", status: 404 };
  }

  const references = Array.isArray(owner.business) ? owner.business : [];

   
  
  const isLinked = references.some((reference) => {
  if (!reference || typeof reference !== "object") {
    return false;
  }
 

  return (
    String(reference.businessId ?? "") === String(businessId) &&
    String(reference.collection ?? "").toLowerCase() ===
      String(CATEGORIES[category] ?? "").toLowerCase()
  );
});

 


  if (!isLinked) {
    return { error: "Business not found in your account.", status: 404 };
  }

  const business = await db.collection(CATEGORIES[category]).findOne({
    _id: new ObjectId(businessId),
    ownerId: new ObjectId(session.user.id),
  });

  if (!business) {
    return { error: "Business not found.", status: 404 };
  }

  return { business, collection: CATEGORIES[category] };
}

export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    const { searchParams } = new URL(request.url);

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB);

    const result = await getOwnedBusiness(
      db,
      session,
      searchParams.get("businessId"),
      searchParams.get("category")?.toLowerCase()
    );
   
    
    

    if (result.error) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status }
      );
    }

    const business = result.business;
    const category = searchParams.get("category").toLowerCase();

    return NextResponse.json({
      success: true,
      business: {
        ...business,
        _id: business._id.toString(),
        category,
        businessName: business.businessName || business.name || "",
      },
    });
  } catch (error) {
    console.error("Fetch business profile error:", error);

    return NextResponse.json(
      { error: "Failed to load business profile." },
      { status: 500 }
    );
  }
}

export async function PUT(request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "Please sign in first." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const businessId = String(body.businessId || "");
    const category = String(body.category || "").toLowerCase();

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB);

    const result = await getOwnedBusiness(
      db,
      session,
      businessId,
      category
    );

    if (result.error) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status }
      );
    }

    const {
      name,
      phone,
      email,
      address,
      city,
      pincode,
      lat,
      lng,
      imageUrl,
     
    } = body;

    const businessName = String(name || "").trim();

    if (!businessName) {
      return NextResponse.json(
        { error: "Business name is required." },
        { status: 400 }
      );
    }

   

  

    const parseCoordinate = (value, min, max, field) => {
      if (value === "" || value == null) return null;

      const number = Number(value);

      if (!Number.isFinite(number) || number < min || number > max) {
        throw new Error(`Invalid ${field}.`);
      }

      return number;
    };

    let latitude;
    let longitude;

    try {
      latitude = parseCoordinate(lat, -90, 90, "latitude");
      longitude = parseCoordinate(lng, -180, 180, "longitude");
    } catch (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    const update = {
      businessName,
      name: businessName,
      phone: String(phone || "").trim(),
      email: String(email || "").trim().toLowerCase(),
      address: String(address || "").trim(),

      imageUrl: String(imageUrl || "").trim(),
     
      updatedAt: new Date(),
    };

    if (latitude !== null) {
      update.lat = latitude;
    }

    if (longitude !== null) {
      update.lng = longitude;
    }

    const updateResult = await db.collection(result.collection).updateOne(
      {
        _id: result.business._id,
        ownerId: new ObjectId(session.user.id),
      },
      { $set: update }
    );

    if (!updateResult.matchedCount) {
      return NextResponse.json(
        { error: "Business not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Business profile updated successfully.",
    });
  } catch (error) {
    console.error("Update business profile error:", error);

    return NextResponse.json(
      { error: "Failed to update business profile." },
      { status: 500 }
    );
  }
}


export async function DELETE(request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email || !session.user.id) {
      return NextResponse.json(
        { error: "Please sign in first." },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);

    const businessId = searchParams.get("businessId");
    const category = searchParams.get("category")?.toLowerCase();

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB);

    const result = await getOwnedBusiness(
      db,
      session,
      businessId,
      category
    );

    if (result.error) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status }
      );
    }

    const deleteResult = await db
      .collection(result.collection)
      .deleteOne({
        _id: result.business._id,
        ownerId: new ObjectId(session.user.id),
      });

    if (!deleteResult.deletedCount) {
      return NextResponse.json(
        { error: "Business not found or already deleted." },
        { status: 404 }
      );
    }

    // Remove the deleted business reference from the owner's account.
    await db.collection("owners").updateOne(
      {
        email: {
          $regex: `^${escapeRegex(session.user.email.trim())}$`,
          $options: "i",
        },
      },
      {
        $pull: {
          business: {
            businessId: businessId,
            category: category,
          },
        },
      }
    );

    return NextResponse.json({
      success: true,
      message: "Business deleted successfully.",
      businessId,
      category,
    });
  } catch (error) {
    console.error("Delete business error:", error);

    return NextResponse.json(
      { error: "Failed to delete business." },
      { status: 500 }
    );
  }
}