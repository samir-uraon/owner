 
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { createHash } from "node:crypto";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

 

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

const ALLOWED_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export async function POST(request) {
  try {
    // 1. Authenticate the team member
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { message: "Please log in first." },
        { status: 401 }
      );
    }

    const role = String(session.user.role || "").toLowerCase();

    if (!["doctor", "staff"].includes(role)) {
      return NextResponse.json(
        { message: "Only doctors and staff can upload profile images." },
        { status: 403 }
      );
    }

    // 2. Check Cloudinary environment variables
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (!cloudName || !apiKey || !apiSecret) {
      console.error("Cloudinary environment variables are missing.");

      return NextResponse.json(
        { message: "Image upload is not configured on the server." },
        { status: 500 }
      );
    }

    // 3. Read and validate the uploaded file
    const formData = await request.formData();
    const file = formData.get("image");

    if (!file || typeof file.arrayBuffer !== "function") {
      return NextResponse.json(
        { message: "Please select an image." },
        { status: 400 }
      );
    }

    if (!ALLOWED_TYPES[file.type]) {
      return NextResponse.json(
        { message: "Only JPG, PNG, and WebP images are allowed." },
        { status: 400 }
      );
    }

    if (file.size === 0 || file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { message: "Image must be larger than 0 bytes and no bigger than 5 MB." },
        { status: 400 }
      );
    }

    // 4. Create a signed Cloudinary upload
    const timestamp = Math.floor(Date.now() / 1000);
    const folder = "zeriy/team-profiles";

    const signatureString =
      `folder=${folder}&timestamp=${timestamp}${apiSecret}`;

    const signature = createHash("sha1")
      .update(signatureString)
      .digest("hex");

    const cloudinaryForm = new FormData();

    cloudinaryForm.append("file", file, file.name || "profile-image");
    cloudinaryForm.append("api_key", apiKey);
    cloudinaryForm.append("timestamp", String(timestamp));
    cloudinaryForm.append("folder", folder);
    cloudinaryForm.append("signature", signature);

    const cloudinaryResponse = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      {
        method: "POST",
        body: cloudinaryForm,
        cache: "no-store",
      }
    );

    const result = await cloudinaryResponse.json();

    if (!cloudinaryResponse.ok || !result.secure_url) {
      console.error("Cloudinary upload failed:", result.error?.message);

      return NextResponse.json(
        { message: "Failed to upload the profile image." },
        { status: 502 }
      );
    }

    // 5. Return the URL for the profile form to save
    return NextResponse.json({
      success: true,
      url: result.secure_url,
      imageUrl: result.secure_url,
      profileImage: result.secure_url,
      publicId: result.public_id,
    });
  } catch (error) {
    console.error("Team profile image upload error:", error);

    return NextResponse.json(
      { message: "An unexpected error occurred while uploading the image." },
      { status: 500 }
    );
  }
}
