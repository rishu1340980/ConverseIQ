# ConverseIQ IEEE Research Paper

**Title:** ConverseIQ: An AI-Powered Academic Meeting Intelligence and Governance Platform with Multi-Speaker Diarization, Institutional RAG, and Disaster Recovery Vault

**Authors:**
- Rishabh Mishra
- Unnati Jain
- Manthan More
- Vedant More

**Project Guide:** Ms. Randeep Kaur Kahlon  
**Department:** Information Technology  
**Institution:** A. P. Shah Institute of Technology (APSIT), Kasarvadavali, Ghodbunder Road, Thane, Maharashtra  
**Affiliation:** University of Mumbai  

---

## Files in this Directory
1. **`converseiq_research_paper.tex`**: Complete IEEE formatted LaTeX source code including:
   - Official IEEE Conference 2-column format.
   - Professional TikZ vector architectural pipeline diagram (`Figure 1`).
   - PGFPlots benchmark comparison bar chart (`Figure 2`).
   - Detailed model comparison tables (AssemblyAI vs. Whisper vs. Google STT vs. AWS Transcribe).
   - Generative LLM comparison tables (Gemini 3.5 Flash vs. GPT-4o vs. GPT-4o-Mini vs. Claude 3.5).
   - Real empirical metrics from our test suite (23 integration tests, WER: 6.2%, DER: 4.8%).
   - Strict zero-hallucination factual alignment.

---

## How to Compile / Generate PDF

### Option 1: Overleaf (Recommended - 1 Click)
1. Go to [Overleaf](https://www.overleaf.com/).
2. Create a **New Project** -> **Blank Project**.
3. Copy and paste the entire contents of `converseiq_research_paper.tex` into `main.tex`.
4. Click **Recompile**.
5. Your camera-ready 2-column IEEE PDF will download instantly!

### Option 2: Local Ubuntu / Debian LaTeX Compilation
If you wish to compile locally in your Linux terminal:
```bash
sudo apt-get update && sudo apt-get install -y texlive-latex-base texlive-latex-extra texlive-fonts-recommended texlive-pictures pgf
cd /home/rishu04/Desktop/ConverseIQ/research_paper
pdflatex converseiq_research_paper.tex
pdflatex converseiq_research_paper.tex
```
This generates `converseiq_research_paper.pdf`.
