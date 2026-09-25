import sys
import asyncio
import edge_tts

async def amain(text, output_path):
    try:
        # Use en-IN-NeerjaExpressiveNeural for a highly realistic, human-like Indian English female voice
        communicate = edge_tts.Communicate(text, "en-IN-NeerjaExpressiveNeural")
        await communicate.save(output_path)
        print("SUCCESS")
    except Exception as e:
        print(f"ERROR: {str(e)}")

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("ERROR: Usage: python coqui_tts.py <text> <output_path>")
        sys.exit(1)
    asyncio.run(amain(sys.argv[1], sys.argv[2]))
