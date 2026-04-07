import requests
from bs4 import BeautifulSoup

def acessar_link_com_seguranca(link):
    # Verifica se o link é seguro
    if not link.startswith(('https://', 'http://')):
        return "Link inválido"
    
    try:
        # Faz a requisição com timeout
        resposta = requests.get(link, timeout=10, headers={
            'User-Agent': 'ZauraBot/1.0'
        })
        
        if resposta.status_code == 200:
            # Retorna o conteúdo de forma segura
            return resposta.text[:5000]  # limite para não sobrecarregar
        else:
            return f"Erro: {resposta.status_code}"
    except Exception as e:
        return f"Não foi possível acessar: {e}"
