FROM python:3.11-slim
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1
WORKDIR /code
COPY requirements.txt /code/
RUN pip install --upgrade pip && pip install -r requirements.txt && pip install pillow
COPY . /code/ 
RUN python manage.py collectstatic --noinput
EXPOSE 8000