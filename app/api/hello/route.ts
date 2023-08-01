import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    return NextResponse.json(
      { success: true, hello: "world", second: "try" },
      { status: 200 }
    );
  } catch (err: any) {
    return NextResponse.json(null, {
      status: err?.statusCode || 500,
      statusText: err?.errorMessage || "Error...",
    });
  }
}
