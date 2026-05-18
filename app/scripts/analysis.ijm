// scripts/analysis.ijm

// 1. Tangkap argumen dari command line (input="path",output="path")
arg = getArgument();
print("Arguments received: " + arg);

// 2. Parsing sederhana untuk mengambil path file
// Kita cari posisi tanda kutip untuk mengambil path aslinya
parts = split(arg, ",");
inputPath = "";
outputPath = "";
metaPath = "";

for (i=0; i<parts.length; i++) {
    if (indexOf(parts[i], "input=") >= 0) {
        inputPath = substring(parts[i], indexOf(parts[i], "\"") + 1, lastIndexOf(parts[i], "\""));
    }
    if (indexOf(parts[i], "output=") >= 0) {
        outputPath = substring(parts[i], indexOf(parts[i], "\"") + 1, lastIndexOf(parts[i], "\""));
    }
    if (indexOf(parts[i], "meta=") >= 0) {
        metaPath = substring(parts[i], indexOf(parts[i], "\"") + 1, lastIndexOf(parts[i], "\""));
    }
}

// 3. Logika Analisis (Inti ImageJ)
if (File.exists(inputPath)) {
    // Force ImageJ to use Bio-Formats to open proprietary files (.czi, .lif, .nd2)
    run("Bio-Formats Importer", "open=[" + inputPath + "] autoscale color_mode=Default rois_import=[ROI manager] view=Hyperstack stack_order=XYCZT");

    // Extract all embedded metadata and save it to the specified text file
    metadata = getMetadata("Info");
    if (metadata != "") {
        File.saveString(metadata, metaPath);
        print("Raw metadata saved to: " + metaPath);
    }

    // Standard Analysis: Auto-Threshold & Measure
    run("8-bit");
    setAutoThreshold("Default");
    run("Set Measurements...", "area mean standard modal min max display add");
    run("Measure");

    // 4. Save results to the requested CSV path
    saveAs("Results", outputPath);

    // Close the image to free up RAM
    close();
    print("Analysis finished. Result saved to: " + outputPath);
} else {
    print("Error: Input file not found at " + inputPath);
}

// Exit ImageJ
eval("script", "System.exit(0);");
