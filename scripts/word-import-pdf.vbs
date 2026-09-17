' word-import-pdf.vbs
' Uses Microsoft Word COM to open a PDF and save as editable DOCX (Smallpdf-class layout).
' Usage: cscript //Nologo word-import-pdf.vbs <inputPdfPath> <outputDocxPath>
'
' Exits 0 and prints "OK" on success.
' Exits 1 and prints an error message on failure.

Option Explicit

Const wdFormatXMLDocument = 16

If WScript.Arguments.Count < 2 Then
    WScript.Echo "USAGE: cscript //Nologo word-import-pdf.vbs <input.pdf> <output.docx>"
    WScript.Quit 1
End If

Dim inputPath, outputPath
inputPath  = WScript.Arguments(0)
outputPath = WScript.Arguments(1)

Dim fso
Set fso = CreateObject("Scripting.FileSystemObject")
If Not fso.FileExists(inputPath) Then
    WScript.Echo "ERROR: Input file not found"
    WScript.Quit 1
End If

inputPath  = fso.GetAbsolutePathName(inputPath)
outputPath = fso.GetAbsolutePathName(outputPath)

Dim outDir
outDir = fso.GetParentFolderName(outputPath)
If Not fso.FolderExists(outDir) Then
    fso.CreateFolder outDir
End If

If fso.FileExists(outputPath) Then
    fso.DeleteFile outputPath, True
End If

Dim wordApp
On Error Resume Next
Set wordApp = CreateObject("Word.Application")
If Err.Number <> 0 Then
    WScript.Echo "ERROR: Cannot create Word.Application - " & Err.Description
    WScript.Quit 1
End If
On Error GoTo 0

wordApp.Visible = False
wordApp.DisplayAlerts = 0
wordApp.AutomationSecurity = 3
' Optional Word.Options properties vary by Office version — ignore if unsupported.
On Error Resume Next
wordApp.Options.ConfirmConversions = False
wordApp.Options.PromptUpdateLinks = False
wordApp.Options.UpdateLinksAtOpen = False
On Error GoTo 0

Dim doc
On Error Resume Next
' Open PDF — Word reflows to editable DOCX layout.
Set doc = wordApp.Documents.Open(inputPath, False, True, False, "", "", True, , , , False, , False)
If Err.Number <> 0 Then
    WScript.Echo "ERROR: Cannot open PDF - " & Err.Description
    wordApp.Quit 0
    WScript.Quit 1
End If
On Error GoTo 0

On Error Resume Next
doc.SaveAs2 outputPath, wdFormatXMLDocument
If Err.Number <> 0 Then
    WScript.Echo "ERROR: SaveAs failed - " & Err.Description
    doc.Close 0
    wordApp.Quit 0
    WScript.Quit 1
End If
On Error GoTo 0

doc.Close 0
wordApp.Quit 0

If Not fso.FileExists(outputPath) Then
    WScript.Echo "ERROR: Output DOCX was not created"
    WScript.Quit 1
End If

If fso.GetFile(outputPath).Size < 1500 Then
    WScript.Echo "ERROR: Output DOCX is too small"
    WScript.Quit 1
End If

WScript.Echo "OK"
WScript.Quit 0
