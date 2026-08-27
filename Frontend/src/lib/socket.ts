import { io, Socket } from 'socket.io-client';

export const socket: Socket = io('http://localhost:5000', {
  autoConnect: false,
});

export const connectSocketWithToken = () => {
  const token = sessionStorage.getItem('token');
  if (token) {
    socket.auth = { token };
    if (!socket.connected) {
      socket.connect();
    }
  }
};