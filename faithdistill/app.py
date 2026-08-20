import streamlit as st
from pathlib import Path
from datetime import datetime
from core.config import config
from core.ingester import Ingester
from core.distiller import Distiller, chunk_text
from core.note_writer import NoteWriter

st.set_page_config(page_title="FaithDistill", page_icon="✝️", layout="wide")

st.title("FaithDistill — 宗教知识蒸馏引擎")
st.caption("把圣经、神学与其他宗教内容，快速变成 Obsidian 原子知识库")

# 侧边栏配置
with st.sidebar:
    st.header("系统配置")
    vault_input = st.text_input("Obsidian Vault 路径", value=str(config.vault_path))
    config.vault_path = Path(vault_input)

    model = st.text_input("LLM 模型", value=config.llm_model)
    config.llm_model = model

    st.markdown("---")
    st.markdown("**使用说明**")
    st.markdown("""
    1. 粘贴或上传内容
    2. 选择主题与宗教
    3. 点击「开始蒸馏」
    4. 笔记自动写入你的 Vault
    """)

# 主界面
col1, col2 = st.columns([2, 1])

with col1:
    st.subheader("1. 输入内容")
    input_method = st.radio("输入方式", ["直接粘贴", "上传 Markdown", "上传 PDF"], horizontal=True)

    text = ""
    if input_method == "直接粘贴":
        text = st.text_area("粘贴圣经章节、注释、文章等", height=300)
    elif input_method == "上传 Markdown":
        uploaded = st.file_uploader("选择 .md 文件", type=["md"])
        if uploaded:
            text = uploaded.read().decode("utf-8")
    else:
        uploaded = st.file_uploader("选择 PDF", type=["pdf"])
        if uploaded:
            temp_path = Path("data/temp.pdf")
            temp_path.parent.mkdir(exist_ok=True)
            temp_path.write_bytes(uploaded.read())
            text = Ingester.from_pdf(temp_path)

with col2:
    st.subheader("2. 蒸馏参数")
    theme = st.selectbox("主题", config.default_themes, index=3)
    religion = st.selectbox("主要宗教视角",
                           ["christianity", "judaism", "islam", "buddhism", "hinduism", "other"])
    intensity = st.slider("期望笔记数量（大约）", 3, 12, 6)

st.markdown("---")

if st.button("🚀 开始蒸馏", type="primary", use_container_width=True):
    if not text or len(text.strip()) < 50:
        st.error("请输入有效内容（至少 50 字符）")
    else:
        try:
            distiller = Distiller()
            writer = NoteWriter()

            # Long input (e.g. a whole book's worth of PDF text) is chunked
            # before hitting the LLM -- a single call over tens of thousands
            # of characters routinely fails to follow the strict output
            # format (especially on smaller local models), which used to
            # silently produce zero parsed notes with no explanation.
            chunks = chunk_text(text, config.chunk_size)

            all_notes = []
            failed_chunks = []
            progress = st.progress(0.0)
            status = st.empty()

            for i, chunk in enumerate(chunks, 1):
                status.text(f"正在处理第 {i}/{len(chunks)} 段（共 {len(text)} 字）...")
                chunk_notes = distiller.distill(chunk, theme=theme, religion=religion)
                if not chunk_notes:
                    failed_chunks.append(i)
                for note in chunk_notes:
                    path = writer.write_permanent_note(note, theme)
                    writer.append_to_moc(theme, note["title"])
                    all_notes.append(note)
                progress.progress(i / len(chunks))

            status.empty()
            progress.empty()

            if not all_notes:
                st.warning("未能解析出有效笔记，请尝试换模型或缩短文本。")
            else:
                st.success(f"成功生成 {len(all_notes)} 张原子笔记（共处理 {len(chunks)} 段）！")
                if failed_chunks:
                    st.warning(f"第 {', '.join(map(str, failed_chunks))} 段未能解析出笔记（模型输出格式不对或该段内容较少），其余段落正常。")

                st.subheader("生成结果")
                for i, note in enumerate(all_notes, 1):
                    with st.expander(f"{i}. {note['title']}"):
                        st.code(note["body"][:800] + ("..." if len(note["body"]) > 800 else ""), language="markdown")

                st.info(f"已写入 Vault：{config.vault_path / config.permanent_dir / theme}")

        except Exception as e:
            st.error(f"蒸馏失败：{str(e)}")
            st.exception(e)

st.markdown("---")
st.caption(f"FaithDistill · Local-First · {datetime.now().strftime('%Y-%m-%d')}")
