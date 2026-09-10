import fs from 'node:fs';

const file = 'src/pages/app-funcionarios/AppFuncionarios.tsx';
const raw = fs.readFileSync(file, 'utf8');
const NL = raw.includes('\r\n') ? '\r\n' : '\n';
let c = raw.replace(/\r\n/g, '\n');

const from = `<Input
                  placeholder="000.000.000-00"
                  className="bg-slate-700/50 border-none text-white h-14 rounded-2xl focus:ring-2 focus:ring-primary"
                  value={cpf}
                  onChange={(e) => setCpf(e.target.value.replace(/\\D/g, '').slice(0, 11))}
                />`;

const to = `<Input
                  id="func-cpf"
                  inputMode="numeric"
                  autoComplete="username"
                  placeholder="000.000.000-00"
                  className="bg-slate-700/50 border-none text-white h-14 rounded-2xl focus:ring-2 focus:ring-primary"
                  value={cpf}
                  onChange={(e) => { setCpf(maskCpfInput(e.target.value)); setLoginError(null); }}
                />`;

if (!c.includes(from)) { console.log('CPF NAO ACHADO'); process.exit(1); }
c = c.replace(from, to);

const from2 = `<Input
                  type="password"
                  placeholder="••••••••"
                  className="bg-slate-700/50 border-none text-white h-14 rounded-2xl focus:ring-2 focus:ring-primary"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />`;

const to2 = `<div className="relative">
                  <Input
                    id="func-pass"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    className="bg-slate-700/50 border-none text-white h-14 rounded-2xl focus:ring-2 focus:ring-primary pr-12"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setLoginError(null); }}
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>`;

if (!c.includes(from2)) { console.log('PASS NAO ACHADO'); process.exit(1); }
c = c.replace(from2, to2);

// labels com htmlFor + bloco de erro + dica abaixo do botão
c = c.replace(
  '<label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">CPF</label>',
  '<label htmlFor="func-cpf" className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">CPF</label>'
);
c = c.replace(
  '<label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Senha</label>',
  '<label htmlFor="func-pass" className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Senha</label>'
);
c = c.replace(
  "{loading ? 'ACESSANDO...' : 'ENTRAR NO APP'}\n              </Button>",
  "{loading ? 'ACESSANDO...' : 'ENTRAR NO APP'}\n              </Button>\n              {loginError && (\n                <div role=\"alert\" className=\"flex items-start gap-2 rounded-2xl bg-red-500/15 border border-red-500/30 px-3 py-2.5 text-sm text-red-200\">\n                  <AlertCircle className=\"h-4 w-4 mt-0.5 shrink-0\" />\n                  <span>{loginError}</span>\n                </div>\n              )}\n              <p className=\"text-center text-[11px] text-slate-500\">\n                Primeiro acesso? Use a senha provisória <span className=\"font-bold text-slate-300\">1234</span> e fale com o responsável para trocar.\n              </p>"
);

fs.writeFileSync(file, c.replace(/\n/g, NL));
console.log('form OK');
