// =========================================================================
// CLOUDSCOPE - EDGE DETECTION MACRO (PROJECT_EDGEDETECT)
// =========================================================================

setBatchMode(true); // Memaksa mode tanpa GUI untuk hemat RAM

// 1. Ambil dan Parsing Argumen
args = getArgument();
parts = split(args, ",");
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

print("Target Input : " + inputPath);
print("Target Output: " + outputPath);
print("Target Meta  : " + metaPath);

// 2. Eksekusi Validasi dan Analisis
if (File.exists(inputPath)) {
    print("Membaca file OME-TIFF secara native...");
    open(inputPath);

    if (nImages == 0) {
        print("ERROR FATAL: Fiji gagal membuka citra OME-TIFF!");
        eval("script", "System.exit(1);");
    }

    // 3. Ekstrak Raw Metadata untuk kebutuhan Privacy Engine
    metadata = getMetadata("Info");
    if (metadata != "") {
        File.saveString(metadata, metaPath);
        print("Raw metadata saved to: " + metaPath);
    }

    // 4. Perataan Z-Projection untuk file multidimensi (WAJIB ADA)
    getDimensions(width, height, channels, slices, frames);
    if (slices > 1 || frames > 1 || channels > 1) {
        print("Mendeteksi file multidimensi... Melakukan Z-Projection...");
        run("Z Project...", "projection=[Max Intensity] all");
    }

    // 5. Konfigurasi & Eksekusi Pengukuran (LOGIKA EDGE DETECTION)
    print("Menjalankan logika Edge Detection...");
    run("8-bit");
    run("Find Edges");
    run("Set Measurements...", "mean standard min max display redirect=None decimal=3");
    run("Measure");

    // 6. Simpan Hasil Analisis CSV
    print("Menyimpan hasil ke: " + outputPath);
    saveAs("Results", outputPath);

    // 7. Cleanup RAM dan Windows
    run("Clear Results");
    run("Close All");
    print("Analysis finished successfully.");
} else {
    print("ERROR: Input file tidak ditemukan di " + inputPath);
    eval("script", "System.exit(1);");
}

eval("script", "System.exit(0);");