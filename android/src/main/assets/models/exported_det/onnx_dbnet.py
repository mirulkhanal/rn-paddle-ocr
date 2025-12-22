import onnxruntime as ort

session = ort.InferenceSession("/Users/meerule/Desktop/ocr/android/src/main/assets/models/exported_det/inference.onnx", providers=["CPUExecutionProvider"])

print("Inputs:")
for i in session.get_inputs():
    print(i.name, i.shape, i.type)

print("\nOutputs:")
for o in session.get_outputs():
    print(o.name, o.shape, o.type)
