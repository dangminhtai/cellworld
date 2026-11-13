# Luật thế giới CELLWORLD

1. 100 tế bào khởi tạo không có gì.
2. Thêm thức ăn cho nó ăn.
3. Tế bào di chuyển random và ăn trong bán kính 90 pixel.
4. Tế bào lớn lên khi ăn, theo 3 màu.
   - Mặc định: xanh lục.
   - Ăn từ 20 cái: vàng.
   - Ăn từ 60 cái: đỏ.
5. Tế bào không được chồng lên nhau hoặc đi xuyên qua nhau.
6. Tế bào lớn hơn ăn được tế bào nhỏ hơn.
7. Tế bào tìm thức ăn trong bán kính 90 pixel. Khi bị chặn, nó đổi hướng để né rồi tìm lại.
8. Tế bào có hai giới tính, đực và cái. Mỗi khi một cặp khác giới vừa chạm nhau, có 50% cơ hội sinh một tế bào mới nếu còn chỗ. Con mới có 50% là đực, 50% là cái. Khi đạt ngưỡng 100 tế bào sống, va chạm không sinh thêm.
9. Một quái vật 👾 đi lang thang. Khi phát hiện tế bào trong bán kính 120 px, nó đuổi con gần nhất và ăn khi chạm. Ăn xong, nó nghỉ săn 15 giây mô phỏng. Tế bào phát hiện quái trong 90 px sẽ chạy trốn.
