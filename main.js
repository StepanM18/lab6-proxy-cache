const http = require('http');
const fs = require('fs/promises');
const path = require('path');
const { Command } = require('commander');
const superagent = require('superagent');

const program = new Command();

program
  .requiredOption('-h, --host <address>', 'адреса сервера')
  .requiredOption('-p, --port <number>', 'порт сервера')
  .requiredOption('-c, --cache <path>', 'шлях до теки кешу');

program.parse(process.argv);
const options = program.opts();

async function ensureCacheDir() {
  try {
    await fs.access(options.cache);
  } catch {
    await fs.mkdir(options.cache, { recursive: true });
    console.log(`Створено теку кешу: ${options.cache}`);
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const code = req.url.slice(1);
    
    if (!code || isNaN(code)) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('Not Found: Invalid status code');
    }

    const cachePath = path.join(options.cache, code);

    if (req.method === 'GET') {
      try {
        const image = await fs.readFile(cachePath);
        res.writeHead(200, { 
          'Content-Type': 'image/jpeg',
          'X-Cache-Source': 'CACHE'
        });
        res.end(image);
      } catch (err) {
        try {
          const response = await superagent.get(`https://http.cat/${code}`);
          const imageBuffer = response.body;
          
          await fs.writeFile(cachePath, imageBuffer);
          
          res.writeHead(200, { 
            'Content-Type': 'image/jpeg',
            'X-Cache-Source': 'HTTP.CAT' 
          });
          res.end(imageBuffer);
        } catch (httpCatErr) {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('Not Found on http.cat');
        }
      }
    } 
    
    else if (req.method === 'PUT') {
      const chunks = [];
      for await (const chunk of req) {
        chunks.push(chunk);
      }
      const buffer = Buffer.concat(chunks);
      
      await fs.writeFile(cachePath, buffer);
      
      res.writeHead(201, { 'Content-Type': 'text/plain' });
      res.end('Created');
    } 
    
    else if (req.method === 'DELETE') {
      try {
        await fs.unlink(cachePath);
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('Deleted');
      } catch (err) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
      }
    } 
    
    else {
      res.writeHead(405, { 
        'Allow': 'GET, PUT, DELETE',
        'Content-Type': 'text/plain' 
      });
      res.end('Method Not Allowed');
    }

  } catch (globalErr) {
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Internal Server Error');
  }
});

async function start() {
  await ensureCacheDir();
  server.listen(options.port, options.host, () => {
    console.log(`Сервер працює на http://${options.host}:${options.port}`);
  });
}

start();