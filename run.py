from server import app

port = 2822 # 0xB06
ipv6 = False

if ipv6:
	import socket

	sock = socket.socket(socket.AF_INET6, socket.SOCK_STREAM)
	sock.bind(('::', port))
	
	app.run(sock=sock)
else:
	app.run(host='0.0.0.0', port=port)
