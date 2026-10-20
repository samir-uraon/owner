
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Readable } from "node:stream";
import { v2 as cloudinary } from "cloudinary";
import clientPromise from "@/lib/mongodb";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

 

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
];

const categories = {
  clinic: {
    collection: "clinics",
    title: "Clinic",
  },
  saloon: {
    collection: "saloons",
    title: "Salon",
  },
  "beauty-parlour": {
    collection: "parlour",
    title: "Beauty Parlour",
  },
  "diagnostic-centre": {
    collection: "diagnostic",
    title: "Diagnostic Centre",
  },
};

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function validateServices(services) {
  if (
    !Array.isArray(services) ||
    services.length === 0 ||
    services.length > 100
  ) {
    return null;
  }

  const normalized = [];
  const seen = new Set();

  for (const service of services) {
    let name;
    let charge;

    if (
      service &&
      typeof service === "object" &&
      !Array.isArray(service)
    ) {
      name = service.name;
      charge = service.charge;
    } else {
      name = service;
      charge = 0;
    }

    if (
      typeof name !== "string" ||
      !name.trim() ||
      name.trim().length > 100
    ) {
      return null;
    }

    if (
      typeof charge !== "number" ||
      !Number.isFinite(charge) ||
      charge < 0 ||
      charge > 100000000
    ) {
      return null;
    }

    const cleanName = name.trim();
    const key = cleanName.toLowerCase();

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);

    normalized.push({
      name: cleanName,
      charge,
    });
  }

  return normalized.length ? normalized : null;
}

function uploadToCloudinary(buffer, mimetype) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "zeric/businesses",
        resource_type: "image",
        allowed_formats: ["jpg", "jpeg", "png", "webp"],
        transformation: [
          {
            width: 1600,
            height: 1600,
            crop: "limit",
            quality: "auto",
            fetch_format: "auto",
          },
        ],
        context: {
          source: "zeric-business-registration",
          original_mimetype: mimetype,
        },
      },
      (error, result) => {
        if (error) {
          reject(error);
          return;
        }

        if (!result?.secure_url || !result?.public_id) {
          reject(new Error("Cloudinary did not return an image URL."));
          return;
        }

        resolve({
          imageUrl: result.secure_url,
          imagePublicId: result.public_id,
        });
      }
    );

    Readable.from(buffer).pipe(stream);
  });
}

export async function POST(req) {
  let db;
  let businessCollection;
  let businessId;
  let ownerId;
  let cloudinaryPublicId;

  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        {
          success: false,
          message: "Please log in first.",
        },
        { status: 401 }
      );
    }

    let body;
    let imageFile = null;

    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const details = formData.get("details");

      if (typeof details !== "string") {
        return NextResponse.json(
          {
            success: false,
            message: "Business details are missing.",
          },
          { status: 400 }
        );
      }

      try {
        body = JSON.parse(details);
      } catch {
        return NextResponse.json(
          {
            success: false,
            message: "Invalid business details.",
          },
          { status: 400 }
        );
      }

      const uploadedFile = formData.get("businessImage");

      if (
        uploadedFile &&
        typeof uploadedFile === "object" &&
        typeof uploadedFile.arrayBuffer === "function" &&
        uploadedFile.size > 0
      ) {
        imageFile = uploadedFile;
      }
    } else {
      body = await req.json();
    }

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid request data.",
        },
        { status: 400 }
      );
    }

    const {
      category,
      businessName,
      phone,
      email,
      address,
      city,
      pincode,
      services,
    } = body;

    const categoryConfig = categories[category];

    if (!categoryConfig) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid business category.",
        },
        { status: 400 }
      );
    }

    if (
      typeof businessName !== "string" ||
      !businessName.trim() ||
      businessName.trim().length > 150
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Enter a valid business name.",
        },
        { status: 400 }
      );
    }

    if (
      typeof phone !== "string" ||
      !/^[6-9]\d{9}$/.test(phone.trim())
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Enter a valid Indian mobile number.",
        },
        { status: 400 }
      );
    }

    if (
      typeof address !== "string" ||
      !address.trim() ||
      address.trim().length > 1000
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Enter a valid business address.",
        },
        { status: 400 }
      );
    }

    if (
      city !== undefined &&
      (typeof city !== "string" || city.trim().length > 100)
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Enter a valid city.",
        },
        { status: 400 }
      );
    }

    if (
      pincode !== undefined &&
      (typeof pincode !== "string" ||
        !/^\d{6}$/.test(pincode.trim()))
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Enter a valid 6-digit PIN code.",
        },
        { status: 400 }
      );
    }

    const businessEmail =
      typeof email === "string" ? email.trim().toLowerCase() : "";

    if (
      businessEmail &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(businessEmail)
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Enter a valid business email address.",
        },
        { status: 400 }
      );
    }

    const cleanedServices = validateServices(services);

    if (!cleanedServices) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Add at least one valid service with a valid charge.",
        },
        { status: 400 }
      );
    }

    const lat = Number(body.lat ?? body.latitude);
    const lng = Number(body.lng ?? body.longitude);

    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      lat < -90 ||
      lat > 90 ||
      lng < -180 ||
      lng > 180
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid business location.",
        },
        { status: 400 }
      );
    }

    // Validate the image before uploading it.
    if (imageFile) {
      if (!ALLOWED_IMAGE_TYPES.includes(imageFile.type)) {
        return NextResponse.json(
          {
            success: false,
            message: "Only JPG, PNG, and WebP images are allowed.",
          },
          { status: 400 }
        );
      }

      if (imageFile.size > MAX_IMAGE_SIZE) {
        return NextResponse.json(
          {
            success: false,
            message: "Business image must be 5 MB or smaller.",
          },
          { status: 400 }
        );
      }
    }

    // Ensure Cloudinary is configured on the server.
    if (
      imageFile &&
      (!process.env.CLOUDINARY_CLOUD_NAME ||
        !process.env.CLOUDINARY_API_KEY ||
        !process.env.CLOUDINARY_API_SECRET)
    ) {
      throw new Error("Cloudinary environment variables are missing.");
    }

    const normalizedEmail = session.user.email
      .trim()
      .toLowerCase();

    const client = await clientPromise;
    db = client.db(process.env.MONGODB);

    const owner = await db.collection("owners").findOne(
      {
        email: {
          $regex: `^${escapeRegex(normalizedEmail)}$`,
          $options: "i",
        },
      },
      {
        projection: {
          _id: 1,
          name: 1,
          email: 1,
        },
      }
    );

    if (!owner) {
      return NextResponse.json(
        {
          success: false,
          message: "Owner account not found.",
        },
        { status: 404 }
      );
    }

    ownerId = owner._id;
    businessCollection = categoryConfig.collection;

    let imageData = {
      imageUrl: "",
      imagePublicId: "",
    };

    if (imageFile) {
      const buffer = Buffer.from(await imageFile.arrayBuffer());

      // Check the actual file signature, not only its MIME type.
      const isJpeg =
        buffer.length >= 3 &&
        buffer[0] === 0xff &&
        buffer[1] === 0xd8 &&
        buffer[2] === 0xff;

      const isPng =
        buffer.length >= 8 &&
        buffer.subarray(0, 8).equals(
          Buffer.from([
            0x89, 0x50, 0x4e, 0x47,
            0x0d, 0x0a, 0x1a, 0x0a,
          ])
        );

      const isWebp =
        buffer.length >= 12 &&
        buffer.toString("ascii", 0, 4) === "RIFF" &&
        buffer.toString("ascii", 8, 12) === "WEBP";

      const validSignature =
        (imageFile.type === "image/jpeg" && isJpeg) ||
        (imageFile.type === "image/png" && isPng) ||
        (imageFile.type === "image/webp" && isWebp);

      if (!validSignature) {
        return NextResponse.json(
          {
            success: false,
            message: "The selected file is not a valid supported image.",
          },
          { status: 400 }
        );
      }

      imageData = await uploadToCloudinary(buffer, imageFile.type);
      cloudinaryPublicId = imageData.imagePublicId;
    }

  const now = new Date();

const counter = await db.collection("counters").findOneAndUpdate(
  { _id: "businessId" },
  { $inc: { sequence: 1 } },
  { upsert: true, returnDocument: "after" }
);

const businessData = {
  id: `clinic-${1000 + counter.sequence}`,
  ownerId,
  ownerName: owner.name || session.user.name || "",
  ownerEmail: normalizedEmail,
  category,
  categoryName: categoryConfig.title,
  name: businessName.trim(),
  phone: phone.trim(),
  email: businessEmail,
  address: address.trim(),
  lat,
  lng,
  services: cleanedServices,
  imageUrl: imageData.imageUrl,
  imagePublicId: imageData.imagePublicId,
  setupCompleted: false,
  createdAt: now,
  updatedAt: now,
};

const insertResult = await db
  .collection(businessCollection)
  .insertOne(businessData);

    businessId = insertResult.insertedId;

    const updateResult = await db.collection("owners").updateOne(
  { _id: ownerId },
  {
    $addToSet: {
      business: {
        businessId,
        collection: categories[category].collection,
      },
    },
    $set: {
      updatedAt: now,
    },
  }
);


    if (updateResult.matchedCount !== 1) {
      throw new Error("Could not link business to owner.");
    }

    return NextResponse.json(
      {
        success: true,
        message: "Business saved successfully.",
        businessId: businessId.toString(),
        category,
        categoryName: categoryConfig.title,
        imageUrl: imageData.imageUrl,
        nextRoute: "/owner/dashboard",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create business error:", error);

    if (db && businessCollection && businessId) {
      try {
        await db.collection(businessCollection).deleteOne({
          _id: businessId,
        });

        if (ownerId) {
          await db.collection("owners").updateOne(
            { _id: ownerId },
            {
              $pull: {
                business: businessId,
              },
            }
          );
        }
      } catch (rollbackError) {
        console.error("Business rollback error:", rollbackError);
      }
    }

    // Remove the uploaded image if saving the business failed.
    if (cloudinaryPublicId) {
      try {
        await cloudinary.uploader.destroy(cloudinaryPublicId, {
          resource_type: "image",
        });
      } catch (cleanupError) {
        console.error("Cloudinary cleanup error:", cleanupError);
      }
    }

    return NextResponse.json(
      {
        success: false,
        message: "Unable to save business. Please try again.",
      },
      { status: 500 }
    );
  }
}






export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "Please log in first." },
        { status: 401 }
      );
    }

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB);

    const normalizedEmail = session.user.email.trim();

    const owner = await db.collection("owners").findOne(
      {
        email: {
          $regex: `^${escapeRegex(normalizedEmail)}$`,
          $options: "i",
        },
      },
      {
        projection: {
          _id: 1,
          name: 1,
          email: 1,
          business: 1,
        },
      }
    );

    if (!owner) {
      return NextResponse.json(
        { error: "Owner account not found." },
        { status: 404 }
      );
    }

    const references = Array.isArray(owner.business)
      ? owner.business
      : [];

    const businesses = await Promise.all(
      references.map(async (reference) => {
        if (!reference || typeof reference !== "object") {
          return null;
        }

        const collectionName = String(
          reference.collection || ""
        ).trim();

        if (!collectionName || !reference.businessId) {
          return null;
        }

         


      

        const business = await db
          .collection(collectionName)
          .findOne({
            _id: reference.businessId,
           ownerId:owner._id
          });

          
           

        if (!business) {
          return null;
        }

        const { _id, ...businessData } = business;

        return {
          ...businessData,
          _id: _id.toString(),   
          collection: collectionName,
          businessName:
            business.businessName || business.name || "",
        };
      })
    );

    const validBusinesses = businesses
      .filter(Boolean)
      .sort(
        (a, b) =>
          new Date(b.createdAt || 0).getTime() -
          new Date(a.createdAt || 0).getTime()
      );

    
      
    return NextResponse.json({
      success: true,
      businesses: validBusinesses,
    });
  } catch (error) {
    console.error("Fetch owner businesses error:", error);

    return NextResponse.json(
      { error: "Failed to load businesses." },
      { status: 500 }
    );
  }
}
