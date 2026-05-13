// scripts/analysis.ijm

// 1. Tangkap argumen dari command line (input="path",output="path")
arg = getArgument();
print("Arguments received: " + arg);

// 2. Parsing sederhana untuk mengambil path file
// Kita cari posisi tanda kutip untuk mengambil path aslinya
parts = split(arg, ",");
inputPath = "";
outputPath = "";

for (i=0; i<parts.length; i++) {
    if (indexOf(parts[i], "input=") >= 0) {
        inputPath = substring(parts[i], indexOf(parts[i], "\"") + 1, lastIndexOf(parts[i], "\""));
    }
    if (indexOf(parts[i], "output=") >= 0) {
        outputPath = substring(parts[i], indexOf(parts[i], "\"") + 1, lastIndexOf(parts[i], "\""));
    }
}

// 3. Logika Analisis (Inti ImageJ)
if (File.exists(inputPath)) {
    open(inputPath);

    // Kita lakukan analisis standar: Auto-Threshold & Measure
    // Ini akan menghasilkan data Area, Mean, Min, Max, dll.
    run("8-bit");
    setAutoThreshold("Default");
    run("Set Measurements...", "area mean standard modal min max display add");
    run("Measure");

    // 4. Simpan hasil ke path CSV yang diminta
    saveAs("Results", outputPath);

    // Tutup gambar agar tidak memenuhi RAM
    close();
    print("Analysis finished. Result saved to: " + outputPath);
} else {
    print("Error: Input file not found at " + inputPath);
}

// Keluar dari ImageJ setelah selesai
eval("script", "System.exit(0);");
