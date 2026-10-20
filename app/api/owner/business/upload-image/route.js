import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { ObjectId } from "mongodb";
import { v2 as cloudinary } from "cloudinary";

import clientPromise from "@/lib/mongodb";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export const runtime = "nodejs";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const COLLECTIONS = {
  clinic: "clinics",
  saloon: "saloons",
  "beauty-parlour": "parlours",
};

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { success: false, message: "Please log in to upload an image." },
        { status: 401 }
      );
    }

    const data = await request.formData();

    const image = data.get("image");
    const businessId = data.get("businessId")?.toString().trim();
    const category = data.get("category")?.toString().trim().toLowerCase();

    if (!image || typeof image === "string") {
      return NextResponse.json(
        { success: false, message: "Please select an image." },
        { status: 400 }
      );
    }

    if (!businessId || !category || !COLLECTIONS[category]) {
      return NextResponse.json(
        { success: false, message: "Invalid business ID or category." },
        { status: 400 }
      );
    }

    if (image.size === 0) {
      return NextResponse.json(
        { success: false, message: "The selected image is empty." },
        { status: 400 }
      );
    }

    const MAX_SIZE = 5 * 1024 * 1024;

    if (image.size > MAX_SIZE) {
      return NextResponse.json(
        { success: false, message: "Image must be smaller than 5 MB." },
        { status: 400 }
      );
    }

    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/avif",
    ];

    if (!allowedTypes.includes(image.type)) {
      return NextResponse.json(
        {
          success: false,
          message: "Only JPG, PNG, WEBP, and AVIF images are allowed.",
        },
        { status: 400 }
      );
    }

    if (
      !process.env.CLOUDINARY_CLOUD_NAME ||
      !process.env.CLOUDINARY_API_KEY ||
      !process.env.CLOUDINARY_API_SECRET
    ) {
      return NextResponse.json(
        { success: false, message: "Image storage is not configured." },
        { status: 500 }
      );
    }

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB);
    const collection = db.collection(COLLECTIONS[category]);

    const idQuery = ObjectId.isValid(businessId)
      ? { $in: [businessId, new ObjectId(businessId)] }
      : businessId;

    const ownerEmail = session.user.email?.toLowerCase();

    const business = await collection.findOne({
      _id: idQuery,
      $or: [
        ...(ownerEmail
          ? [
              { ownerEmail: { $regex: `^${escapeRegex(ownerEmail)}$`, $options: "i" } },
              { email: { $regex: `^${escapeRegex(ownerEmail)}$`, $options: "i" } },
              { "owner.email": { $regex: `^${escapeRegex(ownerEmail)}$`, $options: "i" } },
            ]
          : []),
        ...(session.user.id
          ? [
              { ownerId: session.user.id },
              { userId: session.user.id },
              { "owner.id": session.user.id },
            ]
          : []),
      ],
    });

    if (!business) {
      return NextResponse.json(
        {
          success: false,
          message: "Business not found or you do not have permission to edit it.",
        },
        { status: 404 }
      );
    }

    const buffer = Buffer.from(await image.arrayBuffer());

    const uploadedImage = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: `zeric/businesses/${category}`,
          resource_type: "image",
          transformation: [
            { width: 1200, height: 900, crop: "limit" },
            { quality: "auto", fetch_format: "auto" },
          ],
        },
        (error, result) => {
          if (error) {
            reject(error);
          } else {
            resolve(result);
          }
        }
      );

      stream.end(buffer);
    });

    return NextResponse.json({
      success: true,
      message: "Business image uploaded successfully.",
      imageUrl: uploadedImage.secure_url,
      publicId: uploadedImage.public_id,
    });
  } catch (error) {
    console.error("Business image upload error:", error);

    return NextResponse.json(
      { success: false, message: "Failed to upload business image." },
      { status: 500 }
    );
  }
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}