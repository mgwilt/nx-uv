import torch


def main() -> None:
    print(f"PyTorch: {torch.__version__}")
    print(f"CUDA build: {torch.version.cuda}")
    print(f"HIP build: {torch.version.hip}")
    print(f"CUDA runtime available: {torch.cuda.is_available()}")

    if not torch.cuda.is_available():
        raise RuntimeError(
            "CUDA is not available. Start the container with --gpus all and ensure NVIDIA runtime prerequisites are installed.",
        )

    device = torch.device("cuda")
    model = torch.nn.Sequential(
        torch.nn.Linear(4, 16),
        torch.nn.ReLU(),
        torch.nn.Linear(16, 2),
    ).to(device)
    x = torch.randn(1, 4, device=device)

    with torch.no_grad():
      y = model(x)

    print(f"Inference device: {device}")
    print(f"Output tensor: {y}")


if __name__ == "__main__":
    main()
