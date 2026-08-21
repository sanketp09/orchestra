import PyPDF2, sys
import os

def extract_text(path):
    try:
        with open(path, 'rb') as f:
            reader = PyPDF2.PdfReader(f)
            text = ''
            for page in reader.pages:
                txt = page.extract_text()
                if txt:
                    text += txt + '\n'
            return text
    except Exception as e:
        return f'Error extracting {path}: {e}'

if __name__ == "__main__":
    handbook_path = r'c:\\Users\\Ash\\projects\\atlas\\Procurement Master Handbook (1) (1).pdf'
    aayush_path = r'c:\\Users\\Ash\\projects\\atlas\\aayush kaya.pdf'
    # Write outputs to files to avoid console encoding issues
    handbook_text = extract_text(handbook_path)
    aayush_text = extract_text(aayush_path)
    with open('handbook.txt', 'w', encoding='utf-8') as f:
        f.write(handbook_text)
    with open('aayush.txt', 'w', encoding='utf-8') as f:
        f.write(aayush_text)
    print('Extraction completed. See handbook.txt and aayush.txt')
