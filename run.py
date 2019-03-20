from server import app
import socket

sock = socket.socket(socket.AF_INET6, socket.SOCK_STREAM)
sock.bind(('::', 2822))

app.run(sock=sock)

# app.run(
# 	host='0.0.0.0',
# 	port=2822, # 0xB06
# 	)
