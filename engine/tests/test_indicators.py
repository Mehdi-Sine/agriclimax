from agriclimax.indicators import growing_degree_day

def test_gdd_floor():
    assert growing_degree_day(0, 5, 10) == 0

def test_gdd_value():
    assert growing_degree_day(10, 20, 5) == 10
