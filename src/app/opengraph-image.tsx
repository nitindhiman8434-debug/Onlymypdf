import { ImageResponse } from "next/og";
import { readFileSync } from "fs";
import { join } from "path";
import { APP_NAME } from "@/config/constants";

export const runtime = "nodejs";
export const alt = `${APP_NAME} — Free Online PDF Tools`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const logoSrc = `data:image/png;base64,${readFileSync(
  join(process.cwd(), "public/logos/clean/logo-d-gradient-clean.png")
).toString("base64")}`;

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #ffffff 0%, #eef2ff 100%)",
          fontFamily: "system-ui, sans-serif",
          padding: 64,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={logoSrc}
          alt={APP_NAME}
          width={470}
          height={381}
          style={{ objectFit: "contain" }}
        />
        <div
          style={{
            marginTop: 28,
            fontSize: 34,
            fontWeight: 600,
            color: "#334155",
            textAlign: "center",
            maxWidth: 940,
            lineHeight: 1.35,
          }}
        >
          Merge, Split, Compress, Convert &amp; Edit PDFs — Free Online
        </div>
      </div>
    ),
    { ...size }
  );
}
