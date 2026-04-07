import requests

# Informações da IA
ia_url = "https://api.example.com/ia"
access_token = "SEU_TOKEN_ACESSO"

# Função para realizar a requisição
def acessar_ia(link):
    headers = {
        "Authorization": f"Bearer {access_token}"
    }
    response = requests.get(ia_url, headers=headers, params={"link": link})
    if response.status_code == 200:
        return response.json()
    else:
        return None

# Exemplo de uso
link = "
