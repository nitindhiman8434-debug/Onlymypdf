Option Explicit

If WScript.Arguments.Count < 2 Then
  WScript.Echo "Usage: cscript ppt-to-pdf-com.vbs <input.ppt> <output.pdf>"
  WScript.Quit 1
End If

Dim inputPath, outputPath, fso, ppt, pres, tempPptx, errMsg
inputPath = WScript.Arguments(0)
outputPath = WScript.Arguments(1)

Set fso = CreateObject("Scripting.FileSystemObject")
If Not fso.FileExists(inputPath) Then
  WScript.Echo "Input file not found: " & inputPath
  WScript.Quit 2
End If

inputPath = fso.GetAbsolutePathName(inputPath)
outputPath = fso.GetAbsolutePathName(outputPath)
tempPptx = fso.BuildPath(fso.GetParentFolderName(outputPath), fso.GetBaseName(outputPath) & "_tmp.pptx")

If fso.FileExists(outputPath) Then fso.DeleteFile outputPath, True
If fso.FileExists(tempPptx) Then fso.DeleteFile tempPptx, True

On Error Resume Next
Set ppt = CreateObject("PowerPoint.Application")
If Err.Number <> 0 Then
  WScript.Echo "PowerPoint not available: " & Err.Description
  WScript.Quit 3
End If
Err.Clear

' Uploaded presentations are untrusted: block macro auto-execution.
On Error Resume Next
ppt.AutomationSecurity = 3
On Error GoTo 0

Set pres = ppt.Presentations.Open(inputPath, 0, 0, -1)

Const ppSaveAsOpenXMLPresentation = 24
Const ppFixedFormatTypePDF = 2

pres.SaveAs tempPptx, ppSaveAsOpenXMLPresentation
If Err.Number <> 0 Then
  errMsg = "SaveAs pptx: " & Err.Description
  Err.Clear
Else
  pres.Close
  Set pres = ppt.Presentations.Open(tempPptx, 0, 0, -1)
  Err.Clear
End If

pres.ExportAsFixedFormat2 outputPath, ppFixedFormatTypePDF
If Err.Number <> 0 Then
  errMsg = errMsg & " | Export2: " & Err.Description
  Err.Clear
  pres.ExportAsFixedFormat outputPath, ppFixedFormatTypePDF
End If
If Err.Number <> 0 Then
  errMsg = errMsg & " | Export: " & Err.Description
  Err.Clear
  pres.SaveAs outputPath, 32
End If
If Err.Number <> 0 Then
  WScript.Echo "Export failed: " & errMsg & " | SaveAs pdf: " & Err.Description
  pres.Close
  ppt.Quit
  If fso.FileExists(tempPptx) Then fso.DeleteFile tempPptx, True
  WScript.Quit 4
End If

pres.Close
ppt.Quit
If fso.FileExists(tempPptx) Then fso.DeleteFile tempPptx, True

If Not fso.FileExists(outputPath) Then
  WScript.Echo "Output file was not created"
  WScript.Quit 5
End If

WScript.Echo "OK"
