FROM python:3.11-slim

WORKDIR /app

# Copy requirements and install CPU-optimized PyTorch and dependencies
COPY requirements.txt .
RUN pip install --default-timeout=120 --no-cache-dir --extra-index-url https://download.pytorch.org/whl/cpu -r requirements.txt

# Copy application files
COPY . .

# Create uploads directories
RUN mkdir -p uploads/analysis uploads/reports uploads/profiles uploads/gov_ids

ENV PORT=8000
EXPOSE 8000

CMD ["python3", "app/main.py"]
