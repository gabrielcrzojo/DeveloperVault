**Uvicorn** é um **servidor web ASGI para Python** utilizado para executar aplicações assíncronas, como APIs desenvolvidas com FastAPI e Starlette. Ele recebe requisições HTTP, encaminha para a aplicação e retorna as respostas ao cliente. Não é um framework, mas a infraestrutura responsável por executar e servir a aplicação Python. Atua na camada de **Backend/Web Server**, sendo frequentemente utilizado junto ao FastAPI.

### Roda a API localmente em http://127.0.0.1:8000.
```
uvicorn main:app --reload
```

https://uvicorn.dev/
[[FastAPI]]