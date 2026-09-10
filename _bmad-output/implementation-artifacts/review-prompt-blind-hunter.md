Conduct a review of CONTENT.
Look for what's missing, not only what's wrong.
Find at least ten issues to fix or improve.
Output a Markdown list of findings only — no severity, priority, or ranking.
If the content is empty, stop and say so.
If you have zero findings, re-check and keep thinking; do not stop with an empty list.

CONTENT:
diff --git a/apps/pwa/src/components/pricing/RegionalPricingWidget.tsx b/apps/pwa/src/components/pricing/RegionalPricingWidget.tsx
index 29528dc..0bfca5e 100644
--- a/apps/pwa/src/components/pricing/RegionalPricingWidget.tsx
+++ b/apps/pwa/src/components/pricing/RegionalPricingWidget.tsx
@@ -132,6 +132,7 @@ export const RegionalPricingWidget: React.FC<RegionalPricingWidgetProps> = ({
           return (
             <Button
               key={m.id}
+              type="button"
               variant="pill"
               size="sm"
               isActive={isSelected}
diff --git a/apps/pwa/src/components/profile/ProfileCompletionForm.tsx b/apps/pwa/src/components/profile/ProfileCompletionForm.tsx
index ffa2c28..717f671 100644
--- a/apps/pwa/src/components/profile/ProfileCompletionForm.tsx
+++ b/apps/pwa/src/components/profile/ProfileCompletionForm.tsx
@@ -1211,6 +1211,7 @@ export const ProfileCompletionForm: React.FC<ProfileCompletionFormProps> = ({
 
         {/* Botão de Envio */}
         <Button
+          type="submit"
           variant="cta"
           disabled={isLoading}
           style={{ width: '100%' }}
diff --git a/apps/pwa/src/components/ui/Button.tsx b/apps/pwa/src/components/ui/Button.tsx
index 4f46806..ae2d447 100644
--- a/apps/pwa/src/components/ui/Button.tsx
+++ b/apps/pwa/src/components/ui/Button.tsx
@@ -23,6 +23,7 @@ export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElemen
 
 export const Button: React.FC<ButtonProps> = ({
   children,
+  type = 'button',
   variant = 'secondary',
   size = 'md',
   haptic = true,
@@ -132,6 +133,7 @@ export const Button: React.FC<ButtonProps> = ({
 
   return (
     <button
+      type={type}
       onClick={handleClick}
       disabled={disabled || isLoading}
       style={{ ...getBaseStyle(), ...style }}
diff --git a/tests/pricing-widget-ui.test.js b/tests/pricing-widget-ui.test.js
index a5e5b06..f83d442 100644
--- a/tests/pricing-widget-ui.test.js
+++ b/tests/pricing-widget-ui.test.js
@@ -78,4 +78,34 @@ describe('Story 3.4: Painel Visual do Balizador Regional e Usabilidade (NFR-9)',
     assert.ok(content.includes('<RegionalPricingWidget'), 'Deve instanciar o widget no App.tsx');
     assert.ok(content.includes('Balizador de Preços da sua Região'), 'Deve exibir título explicativo');
   });
+
+  it('deve garantir que os botões de seleção de modal no RegionalPricingWidget tenham type="button" para não submeter formulários', () => {
+    const content = fs.readFileSync(widgetPath, 'utf8');
+    // Verifica que o bloco de renderização dos modais possui type="button"
+    assert.ok(content.includes('type="button"\n              variant="pill"') || content.includes('type="button"'), 'Deve conter type="button" nos botões');
+    // Verifica especificamente dentro do map dos modais
+    const modalBlockMatch = content.match(/\{modals\.map\([\s\S]*?<\/Button>/);
+    assert.ok(modalBlockMatch, 'Deve encontrar bloco de renderização dos modais');
+    assert.ok(modalBlockMatch[0].includes('type="button"'), 'Botão do modal precisa ter type="button" explícito');
+  });
+
+  it('deve garantir que o componente Button tenha type="button" por padrão defensivo', () => {
+    const buttonPath = path.join(process.cwd(), 'apps/pwa/src/components/ui/Button.tsx');
+    const buttonContent = fs.readFileSync(buttonPath, 'utf8');
+
+    assert.ok(buttonContent.includes("type = 'button'"), 'ButtonProps deve ter type padrão "button"');
+    assert.ok(buttonContent.includes('type={type}'), 'Elemento button nativo deve receber type={type}');
+  });
+
+  it('deve garantir que no JobPublishModal o formulário só seja submetido pelo botão "Confirmar e Publicar"', () => {
+    const content = fs.readFileSync(publishModalPath, 'utf8');
+
+    // Apenas um elemento deve ter type="submit" dentro do formulário
+    const submitMatches = content.match(/type="submit"/g);
+    assert.ok(submitMatches && submitMatches.length === 1, 'Deve haver exatamente 1 botão com type="submit" no modal');
+
+    // Verifica que o botão submit é o Confirmar e Publicar
+    assert.ok(content.includes("isSubmitting ? 'Publicando...' : 'Confirmar e Publicar'"), 'Botão submit deve ser o Confirmar e Publicar');
+  });
 });
