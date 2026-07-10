import ast
import glob
import os

routes = glob.glob('caos/server/routes/*.py')
routes.extend(['caos/server/main.py', 'caos/server/identity.py'])

findings = []

for route in routes:
    with open(route, 'r') as f:
        content = f.read()
    try:
        tree = ast.parse(content)
    except Exception:
        continue
    
    for node in ast.walk(tree):
        if isinstance(node, ast.FunctionDef):
            # Check if it's a route handler by looking for decorators
            is_route = any(isinstance(d, ast.Call) and getattr(d.func, 'id', getattr(d.func, 'attr', '')) in ('get', 'post', 'put', 'delete', 'patch') for d in node.decorator_list)
            if is_route:
                has_identity = False
                has_rate_limit = False
                for arg in node.args.args + node.args.kwonlyargs:
                    if isinstance(arg.annotation, ast.Name) and arg.annotation.id == 'CallerIdentity':
                        has_identity = True
                    elif hasattr(arg.annotation, 'id') and arg.annotation.id == 'Depends':
                        has_identity = True # Rough check
                
                # We can refine this, but let's just log it if we want to
                if not has_identity and 'auth' not in route and 'health' not in route:
                    findings.append({'file': route, 'line': node.lineno, 'severity': 'high', 'lens': 'authn', 'summary': f'Route {node.name} missing CallerIdentity dependency.'})
        
        # Check for raw SQL execution
        if isinstance(node, ast.Call):
            if hasattr(node.func, 'attr') and node.func.attr == 'execute':
                # check if argument is raw string
                pass
            
print(findings)
