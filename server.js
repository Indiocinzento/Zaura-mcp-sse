const express = require('express');
const { Pool } = require('pg');
const { spawn } = require('child_process');
const path = require('path');

const app = express();
const port = process.env.PORT || 7860;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Conecta no banco (Neon)
const pool = new Pool({ 
    connectionString: process.env.DATABASE_URL, 
    ssl: { rejectUnauthorized: false } 
});

// Cria a tabela sozinho, sem precisar de migração chata!
async function initDb() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS configs (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255),
            config JSONB NOT NULL
        );
    `);
    console.log("✅ Banco de dados pronto!");
}

// Salva as configurações que a Zaura criar na tela
app.post('/api/configs', async (req, res) => {
    try {
        const { name, config } = req.body;
        const result = await pool.query(
            'INSERT INTO configs (name, config) VALUES ($1, $2) RETURNING id',
            [name, config]
        );
        res.json({ id: result.rows[0].id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/configs', async (req, res) => {
    const result = await pool.query('SELECT id, name FROM configs ORDER BY id DESC');
    res.json(result.rows);
});

// O coração: Mapa que guarda os processos MCP rodando na memória
const activeProcesses = new Map();
const processBuffers = new Map();

// O Endpoint SSE (Onde o cliente se conecta pra ouvir o MCP)
app.get('/sse/:id', async (req, res) => {
    const { id } = req.params;
    const dbRes = await pool.query('SELECT config FROM configs WHERE id = $1', [id]);
    
    if (dbRes.rows.length === 0) return res.status(404).send("Config não encontrada");

    // Pega o comando (ex: uvx) e os argumentos (ex: mcp-server-fetch) do JSON
    const mcpConfig = dbRes.rows[0].config.mcpServers;
    const serverName = Object.keys(mcpConfig)[0];
    const serverConf = mcpConfig[serverName];
    
    if (!serverConf || !serverConf.command) {
        return res.status(400).send("Configuração do MCP tá errada");
    }

    const command = serverConf.command;
    const args = serverConf.args || [];

    // Avisa o navegador que é SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    // Handshake do MCP (manda o endpoint de volta pro cliente)
    res.write(`event: endpoint\ndata: /message/${id}\n\n`);

    // Spawna o processo invisível no servidor
    console.log(`🐾 Spawnando: ${command} ${args.join(' ')}`);
    const child = spawn(command, args);
    
    activeProcesses.set(id, child);
    processBuffers.set(id, '');

    // Pega o que o MCP fala (stdout) e joga pro navegador da Zaura
    child.stdout.on('data', (data) => {
        let buffer = processBuffers.get(id) + data.toString();
        const lines = buffer.split('\n');
        
        // Guarda o último pedaço se ele tiver cortado no meio da palavra
        processBuffers.set(id, lines.pop() || '');
        
        lines.forEach(line => {
            if (line.trim()) {
                res.write(`data: ${line}\n\n`);
            }
        });
    });

    child.stderr.on('data', (data) => {
        console.error(`Erro no MCP [${id}]:`, data.toString());
    });

    child.on('close', () => {
        activeProcesses.delete(id);
        processBuffers.delete(id);
        res.end();
    });

    // Se a Zaura fechar a aba, mata o processo pra não gastar memória à toa
    req.on('close', () => {
        if (activeProcesses.has(id)) {
            child.kill();
            activeProcesses.delete(id);
            processBuffers.delete(id);
        }
    });
});

// Onde o cliente manda os comandos (ex: "busca esse site pra mim")
app.post('/message/:id', express.json(), (req, res) => {
    const child = activeProcesses.get(req.params.id);
    if (!child || !child.stdin.writable) return res.status(404).send("MCP tá morto ou não encontrado");
    
    child.stdin.write(JSON.stringify(req.body) + '\n');
    res.status(202).send("Mensagem enviada!");
});

// Inicia tudo
initDb().then(() => {
    app.listen(port, () => console.log(`🚀 Zaura MCP no ar na porta ${port}!`));
});
