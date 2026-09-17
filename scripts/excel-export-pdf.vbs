' excel-export-pdf.vbs
' Uses Microsoft Excel COM automation to convert XLS/XLSX to PDF.
' Usage: cscript //Nologo excel-export-pdf.vbs <inputPath> <outputPdfPath>
'
' Exits 0 and prints "OK" on success.
' Exits 1 and prints an error message on failure.

Option Explicit

If WScript.Arguments.Count < 2 Then
    WScript.Echo "USAGE: cscript //Nologo excel-export-pdf.vbs <input> <output>"
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

Dim excelApp
On Error Resume Next
Set excelApp = CreateObject("Excel.Application")
If Err.Number <> 0 Then
    WScript.Echo "ERROR: Cannot create Excel.Application - " & Err.Description
    WScript.Quit 1
End If
On Error GoTo 0

excelApp.Visible = False
excelApp.DisplayAlerts = False
excelApp.ScreenUpdating = False
' Uploaded workbooks are untrusted: block macros and never fetch external refs.
excelApp.AutomationSecurity = 3
On Error Resume Next
excelApp.AskToUpdateLinks = False
On Error GoTo 0

Dim wb
On Error Resume Next
' UpdateLinks:=0 stops Excel resolving external workbook / DDE references.
Set wb = excelApp.Workbooks.Open(inputPath, 0, True)
If Err.Number <> 0 Then
    WScript.Echo "ERROR: Cannot open workbook - " & Err.Description
    excelApp.Quit
    WScript.Quit 1
End If
On Error GoTo 0

On Error Resume Next
wb.ExportAsFixedFormat 0, outputPath, 0, True, False, , , False
If Err.Number <> 0 Then
    WScript.Echo "ERROR: Export failed - " & Err.Description
    wb.Close False
    excelApp.Quit
    WScript.Quit 1
End If
On Error GoTo 0

wb.Close False
excelApp.Quit

WScript.Echo "OK"
WScript.Quit 0
