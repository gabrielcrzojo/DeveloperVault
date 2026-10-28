**RAG (Retrieval-Augmented Generation)** é uma técnica que combina recuperação de informações com LLMs para gerar respostas baseadas em dados externos.  
Primeiro, o sistema busca documentos ou trechos relevantes para a pergunta do usuário e os fornece como contexto ao LLM.  
Documentos geralmente são divididos em _chunks_, transformados em **embeddings** e armazenados em um banco vetorial.  
Na consulta, a busca encontra os conteúdos semanticamente mais relevantes, que são enviados ao modelo junto com a pergunta.  
O LLM utiliza esse contexto para gerar uma resposta mais específica e fundamentada nos dados recuperados.  
RAG **não modifica nem treina novamente o modelo**; ele adiciona informações externas durante a execução.

[[LLM]]
