// =========================================================================
// CLOUDSCOPE - STANDARD TIFF HEADLESS MACRO
// =========================================================================

setBatchMode(true); // Memaksa mode tanpa GUI untuk hemat RAM

// 1. Ambil Argumen
args = getArgument();
clean_args = replace(args, "\"", ""); // Bersihkan sisa tanda kutip jika ada
argArray = split(clean_args, ",");

if (argArray.length < 2) {
    print("ERROR FATAL: Argumen input dan output tidak lengkap!");
    eval("script", "System.exit(1);");
}

inputPath = argArray[0];
outputPath = argArray[1];

print("Menerima instruksi dari Celery: " + inputPath + "," + outputPath);
print("Target Input : " + inputPath);
print("Target Output: " + outputPath);

// 2. BUKA FILE DENGAN FUNGSI STANDAR (BUKAN BIO-FORMATS)
print("Membaca file OME-TIFF secara native...");
open(inputPath);

// Verifikasi
if (nImages == 0) {
    print("ERROR FATAL: Fiji gagal membuka citra OME-TIFF!");
    eval("script", "System.exit(1);");
}

// 3. Konfigurasi Analisis
run("Set Measurements...", "area mean standard min integrated redirect=None decimal=3");

// 4. Perataan Z-Projection
getDimensions(width, height, channels, slices, frames);
if (slices > 1 || frames > 1 || channels > 1) {
    print("Mendeteksi file multidimensi... Melakukan Z-Projection...");
    run("Z Project...", "projection=[Max Intensity] all");
}

// 5. Eksekusi Pengukuran
print("Menjalankan pengukuran kuantitatif...");
run("Measure");

// 6. Simpan
print("Menyimpan hasil ke: " + outputPath);
saveAs("Results", outputPath);

// 7. Cleanup
run("Clear Results");
run("Close All");

eval("script", "System.exit(0);");
