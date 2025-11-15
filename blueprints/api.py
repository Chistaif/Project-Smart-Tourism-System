from flask import Blueprint, jsonify, request
from models import db, Destination, Attraction, Tag

api_bp = Blueprint('api', __name__, url_prefix='/api')

# API endpoint to get all destinations
@api_bp.route('/destinations', methods=['GET'])
def get_destinations():
    try:
        destinations = Destination.query.all()
        result = []
        for dest in destinations:
            result.append({
                "id": dest.id,
                "name": dest.name,
                "location": dest.location,
                "briefDescription": dest.brief_description,
                "detailDescription": dest.detail_description,
                "datetimeStart": dest.datetime_start.isoformat() if dest.datetime_start else None,
                "datetimeEnd": dest.datetime_end.isoformat() if dest.datetime_end else None,
                "ticketPrice": dest.ticket_price,
                "lat": dest.lat,
                "lon": dest.lon,
                "tags": [tag.name for tag in dest.tags]
            })
        return jsonify({"success": True, "data": result}), 200
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

# API endpoint to get a single destination by ID
@api_bp.route('/destinations/<int:dest_id>', methods=['GET'])
def get_destination(dest_id):
    try:
        dest = Destination.query.get_or_404(dest_id)
        return jsonify({
            "success": True,
            "data": {
                "id": dest.id,
                "name": dest.name,
                "location": dest.location,
                "briefDescription": dest.brief_description,
                "detailDescription": dest.detail_description,
                "datetimeStart": dest.datetime_start.isoformat() if dest.datetime_start else None,
                "datetimeEnd": dest.datetime_end.isoformat() if dest.datetime_end else None,
                "ticketPrice": dest.ticket_price,
                "lat": dest.lat,
                "lon": dest.lon,
                "tags": [tag.name for tag in dest.tags]
            }
        }), 200
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

# API endpoint to get all attractions
@api_bp.route('/attractions', methods=['GET'])
def get_attractions():
    try:
        attractions = Attraction.query.all()
        result = []
        for attr in attractions:
            result.append({
                "id": attr.id,
                "name": attr.name,
                "location": attr.location,
                "rating": attr.rating,
                "lat": attr.lat,
                "lon": attr.lon,
                "tags": [tag.name for tag in attr.tags]
            })
        return jsonify({"success": True, "data": result}), 200
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

# API endpoint to get attractions by location
@api_bp.route('/attractions/search', methods=['GET'])
def search_attractions():
    try:
        location = request.args.get('location', '')
        if location:
            attractions = Attraction.query.filter(Attraction.location.contains(location)).all()
        else:
            attractions = Attraction.query.all()
        
        result = []
        for attr in attractions:
            result.append({
                "id": attr.id,
                "name": attr.name,
                "location": attr.location,
                "rating": attr.rating,
                "lat": attr.lat,
                "lon": attr.lon,
                "tags": [tag.name for tag in attr.tags]
            })
        return jsonify({"success": True, "data": result}), 200
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

# Health check endpoint
@api_bp.route('/health', methods=['GET'])
def health_check():
    return jsonify({"success": True, "message": "API is running"}), 200

