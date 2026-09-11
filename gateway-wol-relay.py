import socket
import binascii
from http.server import BaseHTTPRequestHandler, HTTPServer
import urllib.parse

# Configurações do Servidor
HOST = '0.0.0.0'
PORT = 8080

def send_magic_packet(mac_address):
    """
    Envia um pacote mágico Wake-On-LAN (WoL) para o MAC Address informado.
    """
    try:
        # Formata o MAC Address removendo separadores
        mac_clean = mac_address.replace(':', '').replace('-', '').upper()
        if len(mac_clean) != 12:
            return False

        # Cria o payload: 6 bytes de 0xFF seguidos pelo MAC repetido 16 vezes
        payload = b'\xff' * 6 + binascii.unhexlify(mac_clean) * 16

        # Envia como broadcast UDP na porta 9
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
            sock.sendto(payload, ('255.255.255.255', 9))
            
        print(f"[WOL] Magic packet enviado para: {mac_address}")
        return True
    except Exception as e:
        print(f"[ERRO] Falha ao enviar WoL: {e}")
        return False

class WOLHandler(BaseHTTPRequestHandler):
    def do_POST(self):
        # Lê parâmetros da URL (ex: /wol?mac=00:1A:4C:E1:92:01)
        parsed_path = urllib.parse.urlparse(self.path)
        query = urllib.parse.parse_qs(parsed_path.query)
        
        if parsed_path.path == '/wol' and 'mac' in query:
            mac = query['mac'][0]
            success = send_magic_packet(mac)
            
            # Responde com headers apropriados
            self.send_response(200 if success else 400)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*') # Permite requests do BookList local
            self.end_headers()
            
            msg = '{"status":"success"}' if success else '{"status":"error"}'
            self.wfile.write(msg.encode('utf-8'))
        else:
            self.send_response(404)
            self.end_headers()
            
    # Lida com requisições OPTIONS (Preflight do CORS)
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.end_headers()

def run():
    server_address = (HOST, PORT)
    httpd = HTTPServer(server_address, WOLHandler)
    print(f"Gateway WoL Relay rodando na porta {PORT}...")
    print("Pronto para receber comandos de ligar servidores da sua VPN!")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    httpd.server_close()
    print("Servidor encerrado.")

if __name__ == '__main__':
    run()
