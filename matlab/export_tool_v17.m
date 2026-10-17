function export_tool_v17(cfg, outFile)
%EXPORT_TOOL_V17 Export the preferred model (piecewise-cost MXL-R) and the budget planner inputs.
%
%   export_tool_v17(cfg)                 % writes outputs/tool/model_v17.json
%   export_tool_v17(cfg, outFile)
%
%   Adds to the website export of export_tool_json.m:
%     - mxlrpw: the MXL-R with piecewise-linear cost (2,000 draws, stage 23.9):
%       means and SDs, 1000 Krinsky-Robb draws of (mean, SD) and 1000 Latin
%       hypercube standard normal draws for the simulated population
%     - chsp: CHSP 2025-26 unit price ranges and the labelled cost assumptions
%       used by prog_cost.m
%     - check: values computed here with exactly the exported draws (acceptance
%       and welfare of the eight scenarios, the fee table of the reference
%       programme and the budget-constrained choice at three budgets), which the
%       website test (tests/validate.mjs) must reproduce
%   Runs in MATLAB and in GNU Octave (jsonencode). Requires stages 23.9 and 23.10.
if nargin < 1 || isempty(cfg), cfg = config(); addpath(cfg.fun_dir); end
if nargin < 2 || isempty(outFile), outFile = fullfile(cfg.out_dir, 'tool', 'model_v17.json'); end
R = 1000; NIND = 1000; SEED = 20261017;
set_seed(SEED);
S = load(fullfile(cfg.res_dir, 's23e_checks.mat')); J = S.chk.J;
P = load(fullfile(cfg.res_dir, 's23f_policy.mat')); pol = P.pol;
m = J.(sprintf('P%d', cfg.rev2.R_primary)); sp = m.spec; xn = m.xnames(:)'; K = numel(xn);
map = @(th) deal_ms(th, sp, K);
[mu0, sd0] = map(m.theta(:));
C = (m.cov_robust + m.cov_robust') / 2; [V, E] = eig(C); A = V * diag(sqrt(max(diag(E), 0)));
Dk = repmat(m.theta(:)', R, 1) + randn(R, numel(m.theta)) * A';
MU = zeros(R, K); SD = zeros(R, K);
for r = 1:R, [MU(r, :), SD(r, :)] = map(Dk(r, :)'); end
nr = numel(sp.rand); Z = zeros(NIND, nr);
for j = 1:nr, u = (randperm(NIND)' - 0.5) / NIND; Z(:, j) = norminv_(u); end
out.meta = struct('model', m.name, 'draws', m.R, 'loglik', m.ll, 'k', m.k, 'n_individuals', NIND, 'R', R, 'seed', SEED, ...
                  'created', datestr(now, 'yyyy-mm-dd HH:MM'), 'platform', ternary(is_octave(), ['GNU Octave ' OCTAVE_VERSION], ['MATLAB ' version]), ...
                  'knots', [5 20], 'welfare', 'area under the acceptance curve from the fee to A$50 (lower bound; no extrapolation beyond the design range)');
out.mxlrpw = struct('name', 'MXL-R, piecewise cost', 'params', {xn}, 'mean', sig(mu0, 6), 'sd', sig(sd0, 6), 'random', sp.rand(:)' - 1, ...
                    'slopes', {{'cost: slope A$0-5', 'cost: slope A$5-20', 'cost: slope A$20-50'}}, 'draws_mean', sig(MU, 5), 'draws_sd', sig(SD, 5), 'z', round(Z * 1e4) / 1e4);
assert(all(strcmp(xn(14:16), out.mxlrpw.slopes)), 'export_tool_v17: unexpected cost column names %s', strjoin(xn(14:16), ', '));
out.chsp = struct('group_social_support', cfg.chsp.group_social_support, 'specialised_support', cfg.chsp.specialised_support, ...
                  'transport_trip', cfg.chsp.transport_trip, 'carer_share', cfg.chsp.assume.carer_share, 'virtual_factor', cfg.chsp.assume.virtual_factor, ...
                  'funded_group', cfg.chsp.funded_group, 'funded_specialised', cfg.chsp.funded_specialised, 'funded_transport', cfg.chsp.funded_transport, ...
                  'hours', cfg.attr.hours_values, 'source', 'CHSP national unit price ranges 2025-26 (Department of Health, Disability and Ageing); funded: CHSP grant expenditure per unit delivered 2024-25 (GEN); carer share and virtual factor are assumptions');
% ---- checks with the exported population (point estimates) --------------------
Dz = struct('A', [], 'Bx', [], 'g', []);
mur = out.mxlrpw.mean; sdr = out.mxlrpw.sd; Zr = out.mxlrpw.z;          % exactly the exported (rounded) values
B = repmat(mur, NIND, 1); B(:, sp.rand) = B(:, sp.rand) + Zr .* repmat(sdr(sp.rand), NIND, 1);
Dz.A = B(:, 1); Dz.Bx = B(:, 2:13); Dz.g = mur(14:16)'; Dz.R = NIND;
codes = cfg.scenarios.codes; feeS = cfg.attr.cost_values(codes(:, 7))';
uS = pol_util(codes, Dz, cfg);
out.check.scenarios = struct('codes', codes, 'fee', feeS, 'acceptance', pol_accept(uS, feeS, Dz.g)', 'welfare', pol_welfare(uS, feeS, Dz.g, false)', ...
                             'cost_central', prog_cost(codes, cfg, 'central')', 'cost_low', prog_cost(codes, cfg, 'low')', 'cost_high', prog_cost(codes, cfg, 'high')', ...
                             'cost_funded', prog_cost(codes, cfg, 'funded')');
b0 = codes(cfg.scenarios.reference, :); u0 = pol_util(b0, Dz, cfg); fz = [0 2.35 5 10 20 50];
out.check.fees = struct('fee', fz, 'acceptance', arrayfun(@(p) pol_accept(u0, p, Dz.g), fz), ...
                        'welfare_loss', arrayfun(@(p) pol_welfare(u0, 0, Dz.g) - pol_welfare(u0, p, Dz.g), fz));
out.check.never_free = mean(u0 < 0);
S3 = codes(3, :); uC = pol_util(S3, Dz, cfg);
vA = u0 + pw_cost(20) * Dz.g; vB = uC + pw_cost(20) * Dz.g; den = 1 + exp(vA) + exp(vB); pa = exp(vA) ./ den; p0 = 1 ./ den;
out.check.diversion_none = mean(pa .* p0) / mean(pa .* (1 - pa));        % reference at A$20 beside counselling at A$20
out.check.share_none_two = mean(p0);
Bd = pol.Bd; cst = prog_cost(Bd, cfg, 'central'); Bref = pol_accept(u0, 5, Dz.g) * (prog_cost(b0, cfg, 'central') - 5);
budgets = Bref * [0.5 1 2]; fg = 0:0.5:50;
Sz = plan_budget(Dz, Bd, cst, cfg, struct('fees', fg, 'budgets', budgets));
Sc = plan_budget(Dz, Bd, cst, cfg, struct('fees', fg, 'budgets', budgets, 'cap', 0.5));
out.check.budget = struct('budgets_per_person_session', budgets, 'best_design', Bd(Sz.best(:, 1), 1:6), 'best_fee', fg(Sz.best(:, 2)), 'welfare', Sz.Wb', 'acceptance', Sz.Pb', ...
                          'cap50_best_design', Bd(Sc.best(:, 1), 1:6), 'cap50_best_fee', fg(Sc.best(:, 2)), 'cap50_welfare', Sc.Wb', ...
                          'acc_max_design', Bd(Sz.acc_max(1), 1:6), 'acc_max_fee', fg(Sz.acc_max(2)), 'w_max_design', Bd(Sz.w_max(1), 1:6), 'w_max_fee', fg(Sz.w_max(2)));
folder = fileparts(outFile); if ~isempty(folder) && ~exist(folder, 'dir'), mkdir(folder); end
fid = fopen(outFile, 'w'); assert(fid > 0, 'Cannot write %s', outFile);
fwrite(fid, jsonencode(out), 'char'); fclose(fid);
fprintf('Wrote %s; reference acceptance at A$5 %.4f; budget choice at the reference budget: %s at A$%.1f.\n', outFile, out.check.fees.acceptance(3), design_label(Bd(Sz.best(2, 1), :), cfg), fg(Sz.best(2, 2)));
end

function [mu, sd] = deal_ms(th, sp, K)
mu = zeros(1, K); sd = zeros(1, K);
mu(sp.fixed) = th(sp.idx.fixed); mu(sp.rand) = th(sp.idx.mean); sd(sp.rand) = abs(th(sp.idx.sd));
end

function y = sig(x, n)
y = x; nz = x ~= 0 & isfinite(x);
y(nz) = round(x(nz) .* 10 .^ (n - 1 - floor(log10(abs(x(nz)))))) ./ 10 .^ (n - 1 - floor(log10(abs(x(nz)))));
end
