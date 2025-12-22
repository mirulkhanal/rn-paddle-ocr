module.exports = {
    dependency: {
        platforms: {
            android: {
                sourceDir: '../android',
                packageImportPath: 'import com.receiptscanner.OcrReceiptScannerPackage;',
            },
            ios: {
                project: './ios/OcrReceiptScanner.xcodeproj',
            },
        },
    },
};

