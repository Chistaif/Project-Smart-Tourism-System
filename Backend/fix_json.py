import json

# Các từ khóa để nhận diện địa điểm Thiên nhiên
NATURE_KEYWORDS = [
    "Vịnh", "Đảo", "Núi", "Hồ", "Thác", "Rừng", "Biển", "Vườn Quốc gia", 
    "Cao nguyên", "Ruộng bậc thang", "Đồi", "Mũi Né", "Tràng An", "Cù Lao", "Đỉnh", "Thung lũng"
]

# Các từ khóa loại trừ (Ví dụ: Chợ nổi trên sông nhưng là Văn hóa)
EXCLUDE_KEYWORDS = ["Chợ", "Phố", "VinWonders", "Sun World"] 

try:
    with open('demo_data.json', 'r', encoding='utf-8') as f:
        data = json.load(f)

    count = 0
    # Duyệt qua danh sách attraction (các địa điểm chung)
    if 'attraction' in data:
        for item in data['attraction']:
            name = item.get('name', '')
            
            # Kiểm tra nếu tên chứa từ khóa thiên nhiên VÀ không chứa từ khóa loại trừ
            is_nature = any(k in name for k in NATURE_KEYWORDS)
            is_excluded = any(k in name for k in EXCLUDE_KEYWORDS)

            if is_nature and not is_excluded:
                item['spotType'] = 'Thiên nhiên'
                
                # Bổ sung tag Thiên nhiên nếu chưa có
                if 'tags' in item and 'Thiên nhiên' not in item['tags']:
                    item['tags'].append('Thiên nhiên')
                
                print(f"✅ Đã gán 'Thiên nhiên' cho: {name}")
                count += 1

    with open('demo_data.json', 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=4)

    print(f"\n=== Hoàn tất! Đã cập nhật {count} địa điểm. ===")

except Exception as e:
    print(f"Lỗi: {e}")