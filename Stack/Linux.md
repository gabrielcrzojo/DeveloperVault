# Linux

**Linux** é um kernel livre e de código aberto que constitui a base de diversos sistemas operacionais, conhecidos como distribuições Linux. É responsável por gerenciar processos, memória, dispositivos, sistemas de arquivos e a comunicação entre hardware e software. É amplamente utilizado em servidores, computadores pessoais, ambientes de desenvolvimento e infraestrutura de computação em nuvem. Destaca-se pela estabilidade, segurança, flexibilidade e capacidade de personalização.

**Current distro:** Fedora Linux 43  
**Package Manager:** DNF5 (`dnf`)  
**Shell:** Bash (padrão, configurável)

---

## Principais comandos Linux

### 1. Navegação entre diretórios

|Comando|Função|
|---|---|
|`pwd`|Exibe o diretório atual.|
|`ls`|Lista arquivos e diretórios.|
|`ls -la`|Lista arquivos, incluindo ocultos e permissões.|
|`cd pasta`|Acessa um diretório.|
|`cd ..`|Retorna ao diretório anterior na hierarquia.|
|`cd ~`|Acessa o diretório home.|
|`cd -`|Retorna ao diretório visitado anteriormente.|
|`clear`|Limpa a visualização do terminal.|

### 2. Manipulação de arquivos e diretórios

|Comando|Função|
|---|---|
|`mkdir pasta`|Cria um diretório.|
|`mkdir -p a/b`|Cria diretórios aninhados.|
|`touch arquivo.txt`|Cria um arquivo vazio ou atualiza sua data de modificação.|
|`cp origem destino`|Copia um arquivo.|
|`cp -r origem destino`|Copia diretórios recursivamente.|
|`mv origem destino`|Move ou renomeia arquivos.|
|`rm arquivo`|Remove um arquivo.|
|`rm -r pasta`|Remove um diretório e seu conteúdo.|
|`cat arquivo`|Exibe o conteúdo de um arquivo.|
|`less arquivo`|Permite visualizar arquivos paginados.|
|`nano arquivo`|Abre o editor de texto Nano.|

> **Atenção:** `rm -r` pode excluir dados permanentemente. Confira o caminho antes de executar.

### 3. Pesquisa e filtragem

|Comando|Função|
|---|---|
|`find . -name "*.py"`|Localiza arquivos Python no diretório atual e subdiretórios.|
|`grep "texto" arquivo`|Pesquisa texto em um arquivo.|
|`grep -r "texto" .`|Pesquisa recursivamente em arquivos.|
|`which python3`|Localiza o executável no PATH.|
|`history`|Exibe o histórico de comandos.|
|`comando \| grep texto`|Filtra a saída de um comando.|

### 4. Gerenciamento de pacotes — Fedora 43 (DNF5)

|Comando|Função|
|---|---|
|`sudo dnf upgrade --refresh`|Atualiza os pacotes e renova os metadados.|
|`sudo dnf install pacote`|Instala um pacote.|
|`sudo dnf remove pacote`|Remove um pacote.|
|`dnf search pacote`|Pesquisa pacotes disponíveis.|
|`dnf info pacote`|Exibe informações sobre um pacote.|
|`dnf list --installed`|Lista pacotes instalados.|
|`dnf check-upgrade`|Verifica atualizações disponíveis.|
|`sudo dnf autoremove`|Remove dependências que não são mais necessárias.|
|`sudo dnf clean all`|Limpa o cache do DNF.|
|`dnf history list`|Exibe o histórico de transações.|

### 5. Permissões e usuários

|Comando|Função|
|---|---|
|`sudo comando`|Executa um comando com privilégios elevados.|
|`whoami`|Exibe o usuário atual.|
|`id`|Exibe IDs e grupos do usuário.|
|`chmod +x script.sh`|Torna um script executável.|
|`chmod 644 arquivo`|Define permissões de leitura e escrita para o dono e leitura para os demais.|
|`chown usuario arquivo`|Altera o proprietário de um arquivo.|
|`sudo passwd usuario`|Altera a senha de um usuário.|

### 6. Processos e serviços

|Comando|Função|
|---|---|
|`ps aux`|Lista processos em execução.|
|`top`|Monitora processos e recursos.|
|`kill PID`|Envia sinal de encerramento a um processo.|
|`systemctl status serviço`|Consulta o estado de um serviço.|
|`sudo systemctl start serviço`|Inicia um serviço.|
|`sudo systemctl stop serviço`|Interrompe um serviço.|
|`sudo systemctl restart serviço`|Reinicia um serviço.|
|`sudo systemctl enable serviço`|Habilita inicialização automática.|
|`journalctl -u serviço`|Consulta logs de um serviço.|

### 7. Informações e monitoramento do sistema

|Comando|Função|
|---|---|
|`uname -r`|Exibe a versão do kernel.|
|`cat /etc/os-release`|Exibe informações da distribuição.|
|`hostnamectl`|Exibe informações do sistema e hostname.|
|`free -h`|Exibe utilização da memória RAM.|
|`df -h`|Exibe utilização dos sistemas de arquivos.|
|`du -sh pasta`|Exibe o tamanho de um diretório.|
|`lsblk`|Lista dispositivos de armazenamento.|
|`uptime`|Exibe tempo de atividade e carga do sistema.|
|`reboot`|Reinicia o sistema, conforme permissões.|

### 8. Rede e conectividade

|Comando|Função|
|---|---|
|`ip a`|Exibe interfaces e endereços IP.|
|`ip route`|Exibe a tabela de roteamento.|
|`ping -c 4 google.com`|Testa conectividade enviando quatro pacotes.|
|`curl URL`|Realiza uma requisição HTTP.|
|`wget URL`|Baixa arquivos de uma URL, se instalado.|
|`ss -tuln`|Lista portas TCP/UDP em escuta.|
|`nmcli device status`|Exibe o estado dos dispositivos de rede.|

### 9. Terminal, scripts e automação

|Comando|Função|
|---|---|
|`echo "texto"`|Exibe texto no terminal.|
|`echo $PATH`|Exibe a variável de ambiente PATH.|
|`export VAR=valor`|Define uma variável de ambiente.|
|`source arquivo.sh`|Executa comandos no shell atual.|
|`bash script.sh`|Executa um script Bash.|
|`comando > arquivo`|Redireciona a saída, sobrescrevendo o arquivo.|
|`comando >> arquivo`|Adiciona a saída ao final do arquivo.|
|`comando1 && comando2`|Executa o segundo comando se o primeiro tiver sucesso.|
|`crontab -e`|Edita tarefas agendadas do usuário, se cron estiver instalado.|

### 10. Ajuda e documentação

|Comando|Função|
|---|---|
|`man comando`|Abre o manual do comando.|
|`comando --help`|Exibe as opções disponíveis.|
|`type comando`|Identifica como o shell interpreta um comando.|
|`apropos palavra`|Pesquisa comandos relacionados a um termo, se disponível.|

---

**Observações:** Os comandos DNF apresentados são voltados ao Fedora tradicional (Workstation/Server). Variantes Atomic, como Silverblue, utilizam outro modelo de gerenciamento do sistema, baseado em `rpm-ostree`. Alguns utilitários podem precisar ser instalados separadamente.
[[Tools]]