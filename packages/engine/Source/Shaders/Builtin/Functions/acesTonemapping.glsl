// See:
//    https://knarkowicz.wordpress.com/2016/01/06/aces-filmic-tone-mapping-curve/

vec3 czm_acesTonemapping(vec3 color) {
  /*  float g = 0.985;
    float a = 0.065;
    float b = 0.0001;
    float c = 0.433;
    float d = 0.238;

    color = (color * (color + a) - b) / (color * (g * color + c) + d);

    color = clamp(color, 0.0, 1.0);
    */
    
    
    /////////////////////////////////////////////////
    // the formula above does not seem to be the one from ACES
    float a = 2.51;
	float b = 0.03;
	float c = 2.43;
	float d = 0.59;
	float e = 0.14;
	color = (color * (a * color + b)) / (color * (c * color + d) + e);
    color = clamp(color, 0.0, 1.0);

    return color;
}
