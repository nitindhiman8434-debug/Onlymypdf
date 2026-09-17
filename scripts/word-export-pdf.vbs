' word-export-pdf.vbs
' Uses Microsoft Word COM automation to convert DOC/DOCX to PDF.
' Usage: cscript //Nologo word-export-pdf.vbs <inputPath> <outputPdfPath>
'
' Exits 0 and prints "OK" on success.
' Exits 1 and prints an error message on failure.

Option Explicit

If WScript.Arguments.Count < 2 Then
    WScript.Echo "USAGE: cscript //Nologo word-export-pdf.vbs <input> <output>"
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
' Uploaded documents are untrusted: block macros and never fetch external refs.
wordApp.AutomationSecurity = 3
' Optional Word.Options properties vary by Office version — ignore if unsupported.
On Error Resume Next
wordApp.Options.ConfirmConversions = False
wordApp.Options.PromptUpdateLinks = False
wordApp.Options.UpdateLinksAtOpen = False
On Error GoTo 0

Dim doc
On Error Resume Next
Set doc = wordApp.Documents.Open(inputPath, False, True, False, "", "", True, , , , False, , False)
If Err.Number <> 0 Then
    WScript.Echo "ERROR: Cannot open document - " & Err.Description
    wordApp.Quit 0
    WScript.Quit 1
End If
On Error GoTo 0

On Error Resume Next
doc.ExportAsFixedFormat outputPath, 17
If Err.Number <> 0 Then
    WScript.Echo "ERROR: Export failed - " & Err.Description
    doc.Close 0
    wordApp.Quit 0
    WScript.Quit 1
End If
On Error GoTo 0

doc.Close 0
wordApp.Quit 0

WScript.Echo "OK"
WScript.Quit 0
