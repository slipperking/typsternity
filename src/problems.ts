import type { Problem } from './types'

function countOccurrences(source: string, token: string): number {
  return source.split(token).length - 1
}

function scoreProblem(source: string, basePoints: number): number {
  const lengthBonus = Math.floor(source.length / 12)
  const bracketBonus = Math.floor((source.match(/[()[\]{}]/g) ?? []).length / 14)
  const typingBonus =
    countOccurrences(source, 'bold(') * 2 +
    countOccurrences(source, 'partial') * 2 +
    countOccurrences(source, 'dif') +
    countOccurrences(source, 'integral') * 2 +
    countOccurrences(source, 'sum_') * 2 +
    countOccurrences(source, 'product_') * 2 +
    countOccurrences(source, 'mat(') * 4 +
    countOccurrences(source, 'nabla') * 2 +
    countOccurrences(source, 'Gamma') +
    countOccurrences(source, 'Res') * 2 +
    countOccurrences(source, 'overline(') +
    countOccurrences(source, 'subset.eq') * 2 +
    countOccurrences(source, 'forall') * 2 +
    countOccurrences(source, 'exists') * 2 +
    countOccurrences(source, 'hat(') +
    countOccurrences(source, 'oo') +
    countOccurrences(source, '^(') +
    countOccurrences(source, 'planck') +
    countOccurrences(source, '(') * 2

  return basePoints + lengthBonus + bracketBonus + typingBonus
}

function normalizeBasePoints(basePoints: number): number {
  if (basePoints <= 18) {
    return 8
  }

  if (basePoints <= 24) {
    return 10
  }

  if (basePoints <= 30) {
    return 12
  }

  if (basePoints <= 36) {
    return 14
  }

  return 16
}

function problem(name: string, src: string, pts: number): Problem {
  return { name, src, pts: scoreProblem(src, normalizeBasePoints(pts)) }
}

export const PROBLEMS: Problem[] = [
  problem('Pythagorean Theorem', 'c = sqrt(a^2 + b^2)', 14),
  problem("Euler's Identity", 'e^(pi i) + 1 = 0', 16),
  problem("Bayes' Theorem", 'P(A | B) = (P(B | A) P(A))/P(B)', 18),
  problem('Law of Cosines', 'c^2 = a^2 + b^2 - 2 a b cos C', 18),
  problem('Arithmetic–Geometric Mean', '(x + y)/2 >= sqrt(x y)', 18),
  problem('Quadratic Formula', 'x = (-b plus.minus sqrt(b^2 - 4 a c))/(2 a)', 22),
  problem('Pascal Identity', 'binom(n, k) + binom(n, k + 1) = binom(n + 1, k + 1)', 20),
  problem('Sum of a Binomial Row', 'sum_(k=0)^n binom(n, k) = 2^n', 20),
  problem('Geometric Series', '1/(1 - x) = sum_(n=0)^oo x^n', 20),
  problem('Complex Exponential Form', 'e^(i x) = cos x + i sin x', 20),
  problem('Integration by Parts', 'integral u dif v = u v - integral v dif u', 22),
  problem('Vandermonde Identity', 'sum_(k=0)^r binom(m, k) binom(n, r - k) = binom(m + n, r)', 22),
  problem('Cauchy–Schwarz Inequality', '(sum_(i=1)^n a_i b_i)^2 <= (sum_(i=1)^n a_i^2)(sum_(i=1)^n b_i^2)', 22),
  problem('Sum of First n Squares', 'sum_(i=1)^n i^2 = (n (n + 1)(2 n + 1))/6', 24),
  problem('Binomial Theorem', '(1 + x)^n = sum_(k=0)^n binom(n, k) x^k', 22),
  problem('Exponential Series', 'e^x = sum_(n=0)^oo (x^n)/(n!)', 22),
  problem('Sine Power Series', 'sin x = sum_(n=0)^oo ((-1)^n x^(2 n + 1))/((2 n + 1)!)', 24),
  problem('Cosine Power Series', 'cos x = sum_(n=0)^oo ((-1)^n x^(2 n))/((2 n)!)', 24),
  problem('Taylor Expansion about a Point', 'f(x + h) = sum_(n=0)^oo (f^((n))(x) h^n)/(n!)', 26),
  problem("De Moivre's Formula", '(cos theta + i sin theta)^n = cos(n theta) + i sin(n theta)', 22),
  problem('Normal Distribution Density', 'Phi(x) = 1/(sigma sqrt(2 pi)) e^(-((x - mu)^2)/(2 sigma^2))', 26),
  problem('Wave Equation', '(partial^2 u)/(partial t^2) = c^2 (partial^2 u)/(partial x^2)', 26),
  problem('Cauchy–Riemann Equations', '(partial u)/(partial x) = (partial v)/(partial y) "and" (partial u)/(partial y) = -(partial v)/(partial x) ==> (partial f)/(partial overline(z)) = 0', 26),
  problem("Legendre's Formula", 'nu_p (n!) = sum_(i=1)^oo floor(n/(p^i))', 28),
  problem('Fourier Transform', 'hat(f)(omega) = integral_(-oo)^oo f(x) e^(-2 pi i x omega) dif x', 30),
  problem('Gamma Function Recurrence', 'Gamma(z + 1) = z Gamma(z)', 22),
  problem('Beta–Gamma Relation', 'B(x, y) = (Gamma(x) Gamma(y))/Gamma(x + y)', 30),
  problem('Gaussian Integral', 'integral_(-oo)^oo e^(-x^2) dif x = sqrt(pi)', 32),
  problem('Laplace Transform', 'cal(L){f}(s) = integral_0^oo f(t) e^(-s t) dif t', 30),
  problem('Laplace Derivative Rule', "cal(L){f'(t)} = s F(s) - f(0)", 32),
  problem('Convolution Theorem', 'hat(f * g)(xi) = hat(f)(xi) hat(g)(xi)', 34),
  problem('Leibniz Rule with Moving Bounds', "dif/(dif x) integral_(a(x))^(b(x)) f(x, t) dif t = integral_(a(x))^(b(x)) partial/(partial x) f(x, t) dif t + f(b(x)) b'(x) - f(a(x)) a'(x)", 36),
  problem('Chain Rule in Two Variables', '(dif z)/(dif t) = (partial z)/(partial x) (dif x)/(dif t) + (partial z)/(partial y) (dif y)/(dif t)', 34),
  problem('Black–Scholes Equation', '(partial V)/(partial t) + 1/2 sigma^2 S^2 (partial^2 V)/(partial S^2) + r S (partial V)/(partial S) - r V = 0', 34),
  problem('Ampere–Maxwell Law', 'nabla times bold(B) = mu_0 (bold(J) + epsilon_0 (partial bold(E))/(partial t))', 34),
  problem('Maxwell–Faraday Equation', 'nabla times bold(E) = -(partial bold(B))/(partial t)', 32),
  problem('Einstein Field Equations', 'G_(mu nu) + Lambda g_(mu nu) = (8 pi G)/(c^4) T_(mu nu)', 36),
  problem('Matrix Transpose Product', '(bold(A B))^top = bold(B)^top bold(A)^top', 20),
  problem('Matrix Inverse Product', '(bold(A B))^(-1) = bold(B)^(-1) bold(A)^(-1)', 20),
  problem('Trace Cyclicity', 'op("trace")(bold(A B C)) = op("trace")(bold(B C A)) = op("trace")(bold(C A B))', 22),
  problem('Cayley–Hamilton for 2×2', 'bold(A)^2 - op("trace")(bold(A)) bold(A) + det(bold(A)) bold(I) = 0', 34),
  problem('Matrix Determinant Lemma', 'det(bold(A) + bold(u) bold(v)^top) = (1 + bold(v)^top bold(A)^(-1) bold(u)) det(bold(A))', 36),
  problem('Leibniz Determinant Formula', 'det(bold(A)) = sum_(sigma in S_n) op("sgn")(sigma) product_(i=1)^n a_(i, sigma(i))', 38),
  problem('Spectral Decomposition', 'bold(A) = bold(Q) mat(lambda_1, 0, 0, 0; 0, lambda_2, 0, 0; 0, 0, lambda_3, 0; 0, 0, 0, lambda_4) bold(Q)^(-1)', 36),
  problem('Vector Triple Product', 'bold(a) times (bold(b) times bold(c)) = bold(b) (bold(a) dot bold(c)) - bold(c) (bold(a) dot bold(b))', 38),
  problem('Scalar Triple Product', 'bold(a) dot (bold(b) times bold(c)) = det mat(a_1, a_2, a_3; b_1, b_2, b_3; c_1, c_2, c_3)', 40),
  problem('Lagrange Identity', 'norm(bold(a) times bold(b))^2 = norm(bold(a))^2 norm(bold(b))^2 - (bold(a) dot bold(b))^2', 38),
  problem('Curl of a Curl', 'nabla times (nabla times bold(F)) = nabla (nabla dot bold(F)) - nabla^2 bold(F)', 40),
  problem("Green's Theorem", 'integral.cont_(partial Omega) P dif x + Q dif y = integral.double_Omega ((partial Q)/(partial x) - (partial P)/(partial y)) dif x dif y', 40),
  problem("Green's First Identity", 'integral.double_Omega (u nabla^2 v + nabla u dot nabla v) dif A = integral.cont_(partial Omega) u (partial v)/(partial bold(hat(n))) dif s', 42),
  problem("Green's Second Identity", 'integral.double_Omega (u nabla^2 v - v nabla^2 u) dif A = integral.cont_(partial Omega) (u (partial v)/(partial hat(bold(n))) - v (partial u)/(partial hat(bold(n)))) dif s', 42),
  problem('Divergence Theorem', 'integral.triple_V nabla dot bold(F) dif x dif y dif z = integral.surf_S bold(F) dot hat(bold(n)) dif S', 42),
  problem("Stokes' Theorem", 'integral.cont_C bold(F) dot dif bold(r) = integral.double_S (nabla times bold(F)) dot hat(bold(n)) dif S', 42),
  problem('Parseval Identity', 'integral_(-oo)^oo abs(f(x))^2 dif x = integral_(-oo)^oo abs(hat(f)(xi))^2 dif xi', 42),
  problem('Wirtinger Antiholomorphic Chain Rule', '(partial F)/(partial overline(z)) = (partial F)/(partial w) (partial w)/(partial overline(z)) + (partial F)/(partial overline(w)) (partial overline(w))/(partial overline(z))', 34),
  problem('Christoffel Transformation Law', "Gamma^(i')_(j' k') = (partial x^(i'))/(partial x^r) (partial x^p)/(partial x^(j')) (partial x^q)/(partial x^(k')) Gamma^r_(p q) + (partial x^(i'))/(partial x^r) (partial^2 x^r)/(partial x^(j') partial x^(k'))", 40),
  problem('Global Residue Theorem', 'sum_(k=1)^n op("Res", limits: #true)_(z = z_k) f(z) + op("Res", limits: #true)_(z = oo) f(z) = 0', 34),
  problem('Second Fundamental Theorem of Nevanlinna Theory', "m(r,f) + sum_(nu=1)^q m(r,a_nu,f) <= 2 T(r,f) - N(r,0,f') - 2 N(r,f) + N(r,f') + S(r,f)", 42),
  problem('Nevanlinna Error Term', "S(r,f) = m(r,(f')/f) + m(r,sum_(nu=1)^q (f')/(f - a_nu)) + q log((3 q)/delta) + log 2 - log abs(c')", 42),
  problem('Nevanlinna Deficiency Relation', 'sum_(a in S) [delta(a) + theta(a)] <= sum_(a in S) Theta(a) <= 2', 38),
  problem('Analytic Capacity', `gamma(K) = sup { abs(f'(oo)) : f "is holomorphic on" hat(CC) without K and f(hat(CC) without K) subset.eq overline(DD) and f(oo) = 0 }`, 42),
  problem('Cauchy–Pompeiu Formula', 'f(z) = 1/(2 pi i) (integral.cont.ccw_(partial Omega) (f(zeta))/(zeta - z) dif zeta - integral.double_Omega (partial f)/(partial overline(zeta)) (dif overline(zeta) and dif zeta)/(zeta - z))', 42),
  problem('Schwarz Integral Formula', 'f(z) = 1 / (2 pi i) integral.cont.ccw_(abs(zeta) = r) (Re(f(zeta))) / zeta (zeta+z)/(zeta-z)dif zeta + i Im(f(0))', 42),
  problem('De Morgan Law', 'not (P and Q) <==> (not P) or (not Q)', 22),
  problem('Quantifier Negation', 'not (forall x in X : P(x)) <==> exists x in X : not P(x)', 26),
  problem('Sequent with Entailment', 'Gamma tack.r.double Delta ==> Gamma tack.r.double Delta union {phi}', 24),
  problem('Set-Theoretic Inclusion', 'A subset.eq B and B subset.eq C => A subset.eq C', 22),
  problem('Kronecker Delta Cases', 'delta_(i j) = cases(1 & "if" i = j, 0 & "if" i != j)', 24),
  problem('Modal Distribution', 'square (P -> Q) -> (square P -> square Q)', 24),
  problem('Jensen Formula', 'log abs(f(0)) = 1/(2 pi) integral_0^(2 pi) log abs(f(r e^(i theta))) dif theta - sum_(abs(a_n) < r) log(r/(abs(a_n)))', 38),
  problem('Poisson–Jensen Formula', 'log abs(f(z)) = 1/(2 pi) integral_0^(2 pi) log abs(f(r e^(i theta))) Re((r e^(i theta) + z)/(r e^(i theta) - z)) dif theta - sum_(abs(a_n) < r) log abs((r (z - a_n))/(r^2 - overline(a_n) z)) + sum_(abs(b_n) < r) log abs((r (z - b_n))/(r^2 - overline(b_n) z))', 44),
  problem('Meromorphic Automorphisms of the Riemann Sphere', 'op("PSL")(2, CC) tilde.equiv op("SL")(2, CC) \\/ { plus.minus bold(I) } tilde.equiv op("Aut")(hat(CC))', 34),
  problem('Weierstrass Factorization Theorem', 'f(z) = z^m e^(phi(z)) product_(n=1)^oo E_(p_n)((z)/(a_n))', 38),
  problem("Binet's Theorem", 'F_n = 1 / sqrt(5) ((1 + sqrt(5)) / 2)^n - 1 / sqrt(5) ((1 - sqrt(5)) / 2)^n', 38),
  problem('Reynolds Transport Theorem', '(dif)/(dif t) integral_(Omega(t)) f(x, t) dif V = integral_(Omega(t)) (partial f)/(partial t) dif V + integral_(partial Omega(t)) (bold(v) dot hat(bold(n))) f dif A', 40),
  problem("Cartan's Magic Formula", 'cal(L)_X omega = dif iota_X omega + iota_X dif omega', 28),
  problem('Spherical Derivative', "f^sharp (z) = (2 abs(f'(z)))/(1 + abs(f(z))^2)", 24),
  problem('Gradient by Differential Forms', 'nabla f = (dif f)^sharp', 24),
  problem('Divergence by Differential Forms', 'nabla dot X = star dif star X^flat', 28),
  problem("D'Alembertian Operator", 'square = 1/(c^2) (partial^2)/(partial t^2) - (partial^2)/(partial x^2) - (partial^2)/(partial y^2) - (partial^2)/(partial z^2)', 34),
  problem('Curl by Differential Forms', 'nabla times X = (star dif X^flat)^sharp', 30),
  problem('Stokes–Cartan Formula', 'integral_(partial M) omega = integral_M dif omega', 28),
  problem('Schwarz–Christoffel Mapping Formula', 'f(zeta) = integral^zeta K/((w - a)^(1 - alpha/pi) (w - b)^(1 - beta/pi) (w - c)^(1 - gamma/pi) dots.c) dif w', 40),
  problem('Schrodinger Wave Equation', 'i planck (partial Psi)/(partial t) = -(planck^2)/(2m) nabla^2 Psi + V Psi', 32),
  problem('Chudnovsky Formula for pi', '1/pi = 12 sum_(k=0)^oo ((-1)^k (6 k)! (545140134 k + 13591409))/((3 k)! (k!)^3 640320^(3 k + 3/2))', 42),
]
