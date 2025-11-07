from flask import Blueprint, render_template

auth_bp = Blueprint('auth', __name__, 'auth')

@auth_bp.route('/setting')
def setting():
    return render_template('setting.html')