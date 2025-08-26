import React, { useState, useCallback } from 'react';
import { Upload, FileSpreadsheet, ShoppingCart, AlertCircle, CheckCircle, Download } from 'lucide-react';
import * as XLSX from 'xlsx';

const SistemaSugestaoCompra = () => {
  const [arquivo, setArquivo] = useState(null);
  const [dados, setDados] = useState([]);
  const [sugestoes, setSugestoes] = useState([]);
  const [configuracao, setConfiguracao] = useState({
    colunaEstoque: '',
    colunaVendidos: '',
    colunaProduto: '',
    colunaCusto: '',
    estoqueMinimo: 5,
    multiplicadorSeguranca: 1.2
  });
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState('');
  const [colunas, setColunas] = useState([]);

  const processarArquivo = useCallback((file) => {
    setProcessando(true);
    setErro('');
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target.result;
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
        
        if (jsonData.length < 2) {
          setErro('A planilha deve ter pelo menos uma linha de cabeçalho e uma linha de dados.');
          setProcessando(false);
          return;
        }
        
        const headers = jsonData[0];
        const rows = jsonData.slice(1).map(row => {
          const obj = {};
          headers.forEach((header, index) => {
            obj[header] = row[index] || '';
          });
          return obj;
        });
        
        setColunas(headers);
        setDados(rows);
        setProcessando(false);
      } catch (error) {
        setErro('Erro ao processar o arquivo: ' + error.message);
        setProcessando(false);
      }
    };
    
    reader.readAsArrayBuffer(file);
  }, []);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.name.match(/\.(xlsx|xls)$/)) {
        setErro('Por favor, selecione um arquivo Excel (.xlsx ou .xls)');
        return;
      }
      setArquivo(file);
      processarArquivo(file);
    }
  };

  const calcularSugestoes = () => {
    if (!configuracao.colunaEstoque || !configuracao.colunaVendidos || !configuracao.colunaProduto) {
      setErro('Por favor, configure todas as colunas necessárias.');
      return;
    }

    try {
      const novasSugestoes = dados.map(item => {
        const estoque = parseFloat(item[configuracao.colunaEstoque]) || 0;
        const vendidos = parseFloat(item[configuracao.colunaVendidos]) || 0;
        const produto = item[configuracao.colunaProduto] || 'Produto sem nome';
        const custoUnitario = parseFloat(item[configuracao.colunaCusto]) || 0;
        
        // Cálculo da sugestão: (vendidos * multiplicador) - estoque atual
        const demandaEstimada = vendidos * configuracao.multiplicadorSeguranca;
        const sugestaoCompra = Math.max(0, demandaEstimada - estoque + configuracao.estoqueMinimo);
        
        // Cálculo do valor total da compra
        const valorTotalCompra = sugestaoCompra * custoUnitario;
        
        const status = estoque <= configuracao.estoqueMinimo ? 'crítico' : 
                      sugestaoCompra > 0 ? 'reposição' : 'adequado';
        
        return {
          produto,
          estoqueAtual: estoque,
          vendidos,
          demandaEstimada: Math.round(demandaEstimada),
          sugestaoCompra: Math.round(sugestaoCompra),
          custoUnitario,
          valorTotalCompra: Math.round(valorTotalCompra * 100) / 100, // Arredonda para 2 casas decimais
          status,
          prioridade: estoque <= configuracao.estoqueMinimo ? 'alta' : 
                     sugestaoCompra > vendidos ? 'média' : 'baixa'
        };
      }).filter(item => item.sugestaoCompra > 0 || item.status === 'crítico')
        .sort((a, b) => {
          const prioridadeOrder = { 'alta': 3, 'média': 2, 'baixa': 1 };
          return prioridadeOrder[b.prioridade] - prioridadeOrder[a.prioridade];
        });
      
      setSugestoes(novasSugestoes);
    } catch (error) {
      setErro('Erro ao calcular sugestões: ' + error.message);
    }
  };

  const exportarSugestoes = () => {
    const ws = XLSX.utils.json_to_sheet(sugestoes);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sugestões de Compra');
    XLSX.writeFile(wb, 'sugestoes_compra.xlsx');
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'crítico': return 'text-red-600 bg-red-50 border-red-200';
      case 'reposição': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      default: return 'text-green-600 bg-green-50 border-green-200';
    }
  };

  const getPrioridadeColor = (prioridade) => {
    switch (prioridade) {
      case 'alta': return 'bg-red-500';
      case 'média': return 'bg-yellow-500';
      default: return 'bg-green-500';
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 bg-gray-50 min-h-screen">
      <div className="bg-white rounded-lg shadow-lg p-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-8 flex items-center gap-3">
          <ShoppingCart className="text-blue-600" />
          Sistema de Sugestão de Compra
        </h1>

        {/* Upload de Arquivo */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">1. Carregar Planilha Excel</h2>
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileUpload}
              className="hidden"
              id="file-upload"
            />
            <label htmlFor="file-upload" className="cursor-pointer">
              <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <p className="text-lg font-medium text-gray-700">
                {arquivo ? arquivo.name : 'Clique para selecionar arquivo Excel'}
              </p>
              <p className="text-sm text-gray-500 mt-2">Formatos suportados: .xlsx, .xls</p>
            </label>
          </div>
        </div>

        {erro && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
            <AlertCircle className="text-red-600 h-5 w-5" />
            <span className="text-red-700">{erro}</span>
          </div>
        )}

        {processando && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-blue-700">Processando arquivo...</p>
          </div>
        )}

        {/* Configuração */}
        {colunas.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4">2. Configurar Colunas</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Coluna do Produto
                </label>
                <select
                  value={configuracao.colunaProduto}
                  onChange={(e) => setConfiguracao({...configuracao, colunaProduto: e.target.value})}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Selecione...</option>
                  {colunas.map(col => (
                    <option key={col} value={col}>{col}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Coluna do Estoque
                </label>
                <select
                  value={configuracao.colunaEstoque}
                  onChange={(e) => setConfiguracao({...configuracao, colunaEstoque: e.target.value})}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Selecione...</option>
                  {colunas.map(col => (
                    <option key={col} value={col}>{col}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Coluna de Vendidos
                </label>
                <select
                  value={configuracao.colunaVendidos}
                  onChange={(e) => setConfiguracao({...configuracao, colunaVendidos: e.target.value})}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Selecione...</option>
                  {colunas.map(col => (
                    <option key={col} value={col}>{col}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Coluna do Custo Unitário
                </label>
                <select
                  value={configuracao.colunaCusto}
                  onChange={(e) => setConfiguracao({...configuracao, colunaCusto: e.target.value})}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Selecione...</option>
                  {colunas.map(col => (
                    <option key={col} value={col}>{col}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Estoque Mínimo
                </label>
                <input
                  type="number"
                  value={configuracao.estoqueMinimo}
                  onChange={(e) => setConfiguracao({...configuracao, estoqueMinimo: parseInt(e.target.value) || 0})}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Multiplicador de Segurança
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={configuracao.multiplicadorSeguranca}
                  onChange={(e) => setConfiguracao({...configuracao, multiplicadorSeguranca: parseFloat(e.target.value) || 1})}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            
            <button
              onClick={calcularSugestoes}
              className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium flex items-center gap-2"
            >
              <FileSpreadsheet className="h-5 w-5" />
              Calcular Sugestões
            </button>
          </div>
        )}

        {/* Resultados */}
        {sugestoes.length > 0 && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">3. Sugestões de Compra</h2>
              <button
                onClick={exportarSugestoes}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                Exportar Excel
              </button>
            </div>
            
            <div className="overflow-x-auto">
              <table className="min-w-full bg-white border border-gray-200 rounded-lg">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Prioridade</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Produto</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estoque Atual</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vendidos</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Demanda Estimada</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sugestão Compra</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Custo Unit.</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Valor Total</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {sugestoes.map((item, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-4 py-4">
                        <div className={`w-3 h-3 rounded-full ${getPrioridadeColor(item.prioridade)}`}></div>
                      </td>
                      <td className="px-4 py-4 text-sm font-medium text-gray-900">
                        {item.produto}
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-700">
                        {item.estoqueAtual}
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-700">
                        {item.vendidos}
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-700">
                        {item.demandaEstimada}
                      </td>
                      <td className="px-4 py-4 text-sm font-bold text-blue-600">
                        {item.sugestaoCompra}
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-700">
                        R$ {item.custoUnitario.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-4 text-sm font-bold text-green-600">
                        R$ {item.valorTotalCompra.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-4">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getStatusColor(item.status)}`}>
                          {item.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            <div className="mt-4 bg-gray-50 p-4 rounded-lg">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-gray-600">Total de produtos para compra:</p>
                  <p className="font-bold text-lg text-gray-800">{sugestoes.length}</p>
                </div>
                <div>
                  <p className="text-gray-600">Prioridade alta:</p>
                  <p className="font-bold text-lg text-red-600">
                    {sugestoes.filter(s => s.prioridade === 'alta').length} produtos
                  </p>
                </div>
                <div>
                  <p className="text-gray-600">Investimento total necessário:</p>
                  <p className="font-bold text-xl text-green-600">
                    R$ {sugestoes.reduce((total, item) => total + item.valorTotalCompra, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
              
              {/* Resumo por prioridade */}
              <div className="mt-4 pt-4 border-t border-gray-200">
                <p className="text-sm font-medium text-gray-700 mb-2">Investimento por prioridade:</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
                  {['alta', 'média', 'baixa'].map(prioridade => {
                    const itens = sugestoes.filter(s => s.prioridade === prioridade);
                    const valor = itens.reduce((total, item) => total + item.valorTotalCompra, 0);
                    const corClass = prioridade === 'alta' ? 'text-red-600' : prioridade === 'média' ? 'text-yellow-600' : 'text-green-600';
                    return (
                      <div key={prioridade} className="flex justify-between">
                        <span className="capitalize">{prioridade}:</span>
                        <span className={`font-semibold ${corClass}`}>
                          R$ {valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Informações */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold text-blue-800 mb-2">Como funciona o cálculo:</h3>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>• <strong>Demanda Estimada:</strong> Vendidos × Multiplicador de Segurança</li>
            <li>• <strong>Sugestão de Compra:</strong> (Demanda Estimada - Estoque Atual) + Estoque Mínimo</li>
            <li>• <strong>Valor Total:</strong> Sugestão de Compra × Custo Unitário</li>
            <li>• <strong>Status Crítico:</strong> Quando estoque atual ≤ estoque mínimo</li>
            <li>• <strong>Prioridade Alta:</strong> Produtos com estoque crítico</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default SistemaSugestaoCompra;
