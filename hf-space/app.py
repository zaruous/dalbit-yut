"""Public Laya choice API; the game supplies legal options."""
import threading
import gradio as gr
import laya
import spaces
import torch

MODEL = "callakrsos/dalbit-yut-laya-1500"
INSTRUCTIONS = "Choose the legal Yutnori move with the highest long-term probability of winning."
torch.set_num_threads(4)
_agent = laya.load(MODEL, device="cuda")
_lock = threading.Lock()


@spaces.GPU(duration=20)
def predict(state, criteria):
    if not isinstance(state, str) or len(state) > 16384:
        raise gr.Error("Invalid game state")
    if not isinstance(criteria, dict) or not 2 <= len(criteria) <= 4:
        raise gr.Error("Expected two to four choices")
    if any(not isinstance(k, str) or not isinstance(v, str) or len(v) > 2000 for k, v in criteria.items()):
        raise gr.Error("Invalid choice")
    with _lock:
        with torch.inference_mode():
            result = _agent.predict(state, {"move": {"type": "choice", "instructions": INSTRUCTIONS, "criteria": criteria}}, max_len=1024, head_max_len=512)
    usage = result.get("usage", {})
    if usage.get("truncated") or usage.get("options"):
        raise gr.Error("Model input was truncated")
    choice = result["answers"]["move"].get("choice")
    if choice not in criteria:
        raise gr.Error("Model returned an invalid choice")
    return {"choice": choice}


with gr.Blocks(title="달빛 윷마당 Laya") as app:
    gr.Markdown("# 달빛 윷마당 Laya\n게임에서 합법적인 선택지를 전달받아 하나를 고릅니다.")
    state = gr.Textbox(label="게임 상태")
    criteria = gr.JSON(label="선택지")
    result = gr.JSON(label="선택 결과")
    gr.Button("선택").click(predict, inputs=[state, criteria], outputs=result, api_name="predict")

if __name__ == "__main__":
    app.queue(default_concurrency_limit=1).launch(server_name="0.0.0.0", server_port=7860)
