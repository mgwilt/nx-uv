# /// script
# requires-python = ">=3.11"
# dependencies = ["marimo", "torch==2.5.1", "torchvision==0.20.1", "torchaudio==2.5.1"]
# ///

import marimo
import torch

app = marimo.App()


@app.cell
def _():
    expected_backend = "rocm"
    print(f"PyTorch version: {torch.__version__}")
    print(f"CUDA build: {torch.version.cuda}")
    print(f"HIP build: {torch.version.hip}")
    print(f"CUDA available at runtime: {torch.cuda.is_available()}")
    print(f"Expected backend profile: {expected_backend}")
    device = "cuda" if torch.cuda.is_available() else "cpu"
    model = torch.nn.Linear(4, 2).to(device)
    x = torch.randn(1, 4, device=device)
    with torch.no_grad():
        y = model(x)
    print(f"Device used: {device}")
    print(f"Inference output: {y}")
    return device, expected_backend, model, x, y


if __name__ == "__main__":
    app.run()
