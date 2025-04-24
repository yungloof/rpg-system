const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*', // Permite conexões de qualquer origem (ajuste para produção)
    methods: ['GET', 'POST']
  }
});

// Servir arquivos estáticos (index.html, master.html, etc.)
app.use(express.static(path.join(__dirname, '../public')));

// Caminho para o arquivo characters.json
const CHARACTERS_FILE = path.join(__dirname, 'characters.json');

// Inicializar characters.json se não existir
async function initCharactersFile() {
  try {
    await fs.access(CHARACTERS_FILE);
  } catch {
    await fs.writeFile(CHARACTERS_FILE, JSON.stringify([]));
  }
}
initCharactersFile();

// Ler personagens do arquivo
async function readCharacters() {
  const data = await fs.readFile(CHARACTERS_FILE, 'utf8');
  return JSON.parse(data);
}

// Escrever personagens no arquivo
async function writeCharacters(characters) {
  await fs.writeFile(CHARACTERS_FILE, JSON.stringify(characters, null, 2));
}

io.on('connection', (socket) => {
  console.log('Novo cliente conectado:', socket.id);

  // Enviar lista inicial de personagens ao conectar
  readCharacters().then(characters => {
    socket.emit('updateCharacters', characters);
  }).catch(err => {
    console.error('Erro ao ler characters.json:', err);
    socket.emit('updateCharacters', []);
  });

  // Quando um cliente se conecta como jogador
  socket.on('joinAsPlayer', () => {
    console.log('Jogador conectado:', socket.id);
  });

  // Quando um cliente se conecta como mestre
  socket.on('joinAsMaster', () => {
    console.log('Mestre conectado:', socket.id);
  });

  // Atualizar personagem
  socket.on('updateCharacter', async (character) => {
    try {
      const characters = await readCharacters();
      const index = characters.findIndex(c => c.id === character.id);
      if (index !== -1) {
        characters[index] = character; // Atualizar personagem existente
      } else {
        characters.push(character); // Adicionar novo personagem
      }
      await writeCharacters(characters);
      io.emit('updateCharacters', characters); // Notificar todos os clientes
    } catch (err) {
      console.error('Erro ao atualizar personagem:', err);
    }
  });

  // Atualizar lista de personagens (usado pelo mestre)
  socket.on('updateCharacters', async (updatedCharacters) => {
    try {
      await writeCharacters(updatedCharacters);
      io.emit('updateCharacters', updatedCharacters); // Notificar todos os clientes
    } catch (err) {
      console.error('Erro ao atualizar personagens:', err);
    }
  });

  // Limpar todos os personagens
  socket.on('clearCharacters', async () => {
    try {
      await writeCharacters([]);
      io.emit('updateCharacters', []); // Notificar todos os clientes
    } catch (err) {
      console.error('Erro ao limpar personagens:', err);
    }
  });

  // Receber rolagem de dados de um jogador e enviar ao mestre
  socket.on('playerRoll', (rollData) => {
    io.emit('playerRoll', rollData); // Enviar para todos (principalmente o mestre)
  });

  socket.on('disconnect', () => {
    console.log('Cliente desconectado:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
