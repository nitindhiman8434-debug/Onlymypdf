"use client";

import { ConvertToolPage } from "@/components/tools/convert-tool-page";

export default function PptToPdfPage() {
  return (
    <ConvertToolPage
      title="PowerPoint to PDF"
      description="Convert supported PowerPoint content to PDF. Fonts, images, and complex slide layouts may vary; review the result."
      accept=".ppt,.pptx,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
      uploadHint="Select a .ppt or .pptx file to convert its slide content to PDF"
      processLabel="Convert to PDF"
      processingLabel="Converting to PDF..."
      successTitle="PDF ready!"
      successDescription="Your presentation has been converted. Review slide content and layout in the downloaded PDF."
      downloadLabel="Download PDF"
      outputExtension="pdf"
      apiPath="/api/tools/ppt-to-pdf"
      relatedTools={[
        { name: "PDF to PowerPoint", href: "/pdf-to-ppt" },
        { name: "Word to PDF", href: "/word-to-pdf" },
        { name: "JPG to PDF", href: "/jpg-to-pdf" },
        { name: "Compress PDF", href: "/compress-pdf" },
      ]}
    />
  );
}
