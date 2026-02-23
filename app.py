import streamlit as st
import streamlit.components.v1 as components

# 設定頁面滿版，讓 React App 畫面比例比較正常
st.set_page_config(layout="wide", page_title="作業計時系統")

# 您部署在 GitHub Pages 的網址
github_pages_url = "https://allcrazyit-png.github.io/TaskTiming/"

# 使用 iframe 將網頁嵌入 Streamlit
# height 參數設定為 800 像素，scrolling="yes" 允許在畫面內滾動
components.iframe(github_pages_url, height=800, scrolling=True)
